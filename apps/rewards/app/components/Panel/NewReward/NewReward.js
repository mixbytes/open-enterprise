import PropTypes from 'prop-types'
import React from 'react'
import styled from 'styled-components'

import {
  Button,
  DropDown,
  GU,
  IconCaution,
  IconClose,
  IdentityBadge,
  Info,
  Text,
  TextInput,
  useTheme,
} from '@aragon/ui'

import { Form, FormField } from '../../Form'
import { DateInput } from '../../../../../../shared/ui'
import moment from 'moment'
import { isBefore } from 'date-fns'
import { isAddress } from '../../../utils/web3-utils'
import { ETHER_TOKEN_VERIFIED_BY_SYMBOL } from '../../../utils/verified-tokens'
import TokenSelectorInstance from './TokenSelectorInstance'
import {
  MIN_AMOUNT,
  REWARD_TYPES,
  ONE_TIME_DIVIDEND,
  RECURRING_DIVIDEND,
  ONE_TIME_MERIT,
  MONTHS,
  DISBURSEMENT_UNITS,
  OTHER,
} from '../../../utils/constants'
import { displayCurrency, toWei } from '../../../utils/helpers'

import tokenBalanceOfAbi from '../../../../../shared/json-abis/token-balanceof.json'
import tokenBalanceOfAtAbi from '../../../../../shared/json-abis/token-balanceofat.json'
import tokenCreationBlockAbi from '../../../../../shared/json-abis/token-creationblock.json'
import tokenSymbolAbi from '../../../../../shared/json-abis/token-symbol.json'
import tokenTransferAbi from '../../../../../shared/json-abis/token-transferable.json'

const tokenAbi = [].concat(tokenBalanceOfAbi, tokenBalanceOfAtAbi, tokenCreationBlockAbi, tokenSymbolAbi)

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)

const messages = {
  customTokenInvalid: () => 'Token address must be of a valid ERC20 compatible clonable token.',
  meritTokenTransferable: () => 'Merit rewards must be non-transferable.',
  amountOverBalance: () => 'Amount must be below the available balance.',
  dateStartAfterEnd: () => 'Start date must take place before the end date.',
  singleDisbursement: () => 'While you selected a recurring dividend, based on your parameters, there will only be a single disbursement.',
  dateBeforeAsset: (dateType, tokenSymbol) => `The selected ${dateType} date occurs before the reference asset, ${tokenSymbol}, was created. Please choose another date.`,
}

const INITIAL_STATE = {
  description: '',
  referenceAsset: null,
  referenceAssets: [],
  customToken: {
    isVerified: false,
    value: '',
    address: '',
  },
  rewardType: null,
  amount: '',
  amountToken: {
    balance: '',
    symbol: '',
  },
  dateReference: tomorrow,
  dateStart: tomorrow,
  dateEnd: tomorrow,
  disbursement: '',
  disbursementUnit: MONTHS,
  disbursements: [tomorrow],
  draftSubmitted: false,
  errors: [],
  warnings: [],
}

class NewRewardClass extends React.Component {
  static propTypes = {
    onNewReward: PropTypes.func.isRequired,
    app: PropTypes.object,
    network: PropTypes.object,
    refTokens: PropTypes.array,
    amountTokens: PropTypes.arrayOf(PropTypes.object).isRequired,
    theme: PropTypes.object.isRequired,
  }

  constructor(props) {
    super(props)
    this.state = {
      ...INITIAL_STATE,
      amountToken: props.amountTokens[0],
      referenceAssets: this.getReferenceAssets()
    }
  }

  setDisbursements = (dateStart, dateEnd, disbursement, disbursementUnit) => {
    if (isNaN(disbursement) || disbursement <= 0 ||
        this.state.rewardType !== RECURRING_DIVIDEND) {
      this.setState({ disbursements: [] })
      this.setErrors({ dateStart, dateEnd })
      return
    }
    const date = moment(dateStart).add(disbursement, disbursementUnit)
    const disbursements = []
    while (!date.isAfter(dateEnd, 'days')) {
      disbursements.push(date.toDate())
      date.add(disbursement, disbursementUnit)
    }
    this.setState({ disbursements })
    this.setErrors({ dateStart, dateEnd, disbursements })
  }

  changeField = ({ target: { name, value } }) => {
    this.setState({ [name]: value })
    if (name === 'amount')
      this.setErrors({ amount: value })
  }

  dropDownItems = (name) => {
    if (name == 'amountToken') {
      return this.props.amountTokens.map(token => token.symbol)
    }
    return this.props[name + 's']
  }

  dropDownSelect = (name) => {
    return this.props[name + 's'].indexOf(this.state[name])
  }

  dropDownChange = (name, index) => {
    this.setState({
      [name]: this.props[name + 's'][index],
    })
  }

  onSubmit = () => {
    this.props.onNewReward(this.state)
  }

  submitDraft = () => {
    this.setState({ draftSubmitted: true })
  }

  isDraftValid = () => {
    const {
      description,
      referenceAsset,
      rewardType,
      amount,
      amountToken,
      disbursement,
      disbursements,
      errors,
    } = this.state
    const valid = (
      description !== '' &&
        referenceAsset !== null &&
        !isNaN(amount) && +amount > MIN_AMOUNT &&
        amountToken.symbol !== '' &&
        rewardType !== null && (
        rewardType !== RECURRING_DIVIDEND || (
          !isNaN(disbursement) && +disbursement > 0 &&
              Math.floor(disbursement) === +disbursement 
        ) && (
          !!disbursements.length
        )
      ) &&
        errors.length === 0
    )
    return valid
  }

  getReferenceToken = (state) => {
    const { referenceAsset, customToken } = state
    const { refTokens } = this.props
    const nullAsset = {
      creationDate: new Date(0),
      symbol: null,
    }
    if (referenceAsset === null)
      return nullAsset
    if (referenceAsset === OTHER) {
      if(customToken.isVerified) {
        return customToken
      }
      else return nullAsset
    }
    const selectedToken = refTokens.find(t => (
      t.address === referenceAsset.props.address
    ))
    return selectedToken
  }

  setErrors = (changed) => {
    const state = { ...this.state, ...changed }
    const {
      referenceAsset,
      customToken,
      rewardType,
      transferable,
      amount,
      amountToken,
      dateReference,
      dateStart,
      dateEnd,
    } = state
    const { creationDate, symbol } = this.getReferenceToken(state)
    const errors = []
    const warnings = []

    if (referenceAsset === OTHER && !customToken.isVerified)
      errors.push(messages.customTokenInvalid())
    if (rewardType === ONE_TIME_MERIT && transferable)
      errors.push(messages.meritTokenTransferable())
    if (toWei(amount) > +amountToken.amount)
      errors.push(messages.amountOverBalance())
    if (rewardType === RECURRING_DIVIDEND ||
        rewardType === ONE_TIME_MERIT) {
      if (isBefore(dateEnd, dateStart))
        errors.push(messages.dateStartAfterEnd())
      if (isBefore(dateStart, creationDate)) {
        errors.push(messages.dateBeforeAsset('start', symbol))
      }
      if (isBefore(dateEnd, creationDate)) {
        errors.push(messages.dateBeforeAsset('end', symbol))
      }
    }
    if (rewardType === ONE_TIME_DIVIDEND &&
        isBefore(dateReference, creationDate)) {
      errors.push(messages.dateBeforeAsset('reference', symbol))
    }
    if (rewardType === RECURRING_DIVIDEND &&
        state.disbursements.length <= 1)
      warnings.push(messages.singleDisbursement())

    this.setState({ errors, warnings })
  }

  onMainNet = () => this.props.network.type === 'main'

  showSummary = () => (this.state.referenceAsset > 1 || this.state.customToken.symbol)

  getReferenceAssets() {
    if (!this.props.refTokens) {
      return ['Assets Loading...']
    }
    return [ ...this.getTokenItems(), OTHER ]
  }

  getTokenItems() {
    return this.props.refTokens
      .filter(token => token.startBlock ? true : false)
      .map(({ address, name, symbol, verified }) => (
        <TokenSelectorInstance
          key={address}
          address={address}
          name={name}
          showIcon={verified}
          symbol={symbol}
        />
      ))
  }

  handleCustomTokenChange = event => {
    const { value } = event.target
    const { network } = this.props
    let isVerified = null

    // Use the verified token address if provided a symbol and it matches
    // The symbols in the verified map are all capitalized
    const resolvedAddress =
      !isAddress(value) && network.type === 'main'
        ? ETHER_TOKEN_VERIFIED_BY_SYMBOL.get(value.toUpperCase()) || 'not found'
        : ''

    if (isAddress(value) || isAddress(resolvedAddress)) {
      this.verifyMinime(this.props.app, { address: resolvedAddress || value, value })
      this.verifyTransferable(this.props.app, resolvedAddress || value)
    }
    else {
      isVerified = false
    }
    const customToken = {
      isVerified,
      value,
      address: resolvedAddress,
    }
    this.setState({ customToken })
    this.setErrors({ customToken })
  }

  verifyMinime = async (app, tokenState) => {
    const tokenAddress = tokenState.address
    const token = app.external(tokenAddress, tokenAbi)
    const testAddress = '0xb4124cEB3451635DAcedd11767f004d8a28c6eE7'
    const currentBlock = await app.web3Eth('getBlockNumber').toPromise()
    try {
      const verifiedTests = (await Promise.all([
        await token.balanceOf(testAddress).toPromise(),
        await token.creationBlock().toPromise(),
        await token.balanceOfAt(testAddress,currentBlock).toPromise(),
      ]))
      if (verifiedTests[0] !== verifiedTests[2]) {
        const customToken = { ...tokenState, isVerified: false }
        this.setState({ customToken  })
        this.setErrors({ customToken })
        return false
      }
      const creationBlockNumber = await token.creationBlock().toPromise()
      const creationBlock = await app.web3Eth('getBlock', creationBlockNumber)
        .toPromise()
      const creationDate = new Date(creationBlock.timestamp * 1000)
      const customToken = {
        ...tokenState,
        isVerified: true,
        symbol: await token.symbol().toPromise(),
        startBlock: creationBlockNumber,
        creationDate,
      }
      this.setState({ customToken })
      this.setErrors({ customToken })
      return true
    }
    catch (error) {
      const customToken = { ...tokenState, isVerified: false }
      this.setState({ customToken })
      this.setErrors({ customToken })
      return false
    }
  }

  verifyTransferable = async (app, tokenAddress) => {
    const token = app.external(tokenAddress, tokenTransferAbi)
    const transferable = await token.transfersEnabled().toPromise()
    this.setState({ transferable })
    this.setErrors({ transferable })
  }

  amountWithTokenAndBalance = () => (
    <VerticalContainer>
      <HorizontalContainer>
        <TextInput
          name="amount"
          type="number"
          min={MIN_AMOUNT}
          step="any"
          onChange={this.changeField}
          value={this.state.amount}
          css="border-radius: 4px 0px 0px 4px; flex: 1"
        />
        <DropDown
          name="amountToken"
          css={{ borderRadius: '0px 4px 4px 0px' }}
          items={this.dropDownItems('amountToken')}
          selected={this.dropDownSelect('amountToken')}
          onChange={i => {
            this.dropDownChange('amountToken', i)
            this.setErrors({ amountToken: this.props.amountTokens[i] })
          }}
        />
      </HorizontalContainer>
      <Text
        size="small"
        color={String(this.props.theme.contentSecondary)}
        css={{
          alignSelf: 'flex-end',
          marginTop: '8px',
        }}
      >
        {'Available Balance: '}
        {displayCurrency(this.state.amountToken.amount)}
        {' '}
        {this.state.amountToken.symbol}
      </Text>
    </VerticalContainer>
  )

  startAndEndDate = (isMerit) => (
    <HorizontalContainer>
      <FormField
        label="Start date"
        hint={isMerit && <span>The <b>start date</b> for one-time merits defines the beginning of the review period in which newly accrued amounts of the reference asset will be determined.</span>}
        width={`calc(50% - ${GU}px)`}
        required
        input={
          <DateInput
            name="dateStart"
            horizontalAlign="left"
            wide
            value={this.state.dateStart}
            onChange={dateStart => {
              this.setState({ dateStart })
              this.setDisbursements(
                dateStart,
                this.state.dateEnd,
                this.state.disbursement,
                this.state.disbursementUnit,
              )
            }}
          />
        }
      />
      <FormField
        label="End date"
        hint={isMerit && <span>The <b>end date</b> for one-time merits defines the end of the review period in which newly accrued amounts of the reference asset will be determined.</span>}
        width={`calc(50% - ${GU}px)`}
        required
        input={
          <DateInput
            name="dateEnd"
            wide
            value={this.state.dateEnd}
            onChange={dateEnd => {
              this.setState({ dateEnd })
              this.setDisbursements(
                this.state.dateStart,
                dateEnd,
                this.state.disbursement,
                this.state.disbursementUnit,
              )
            }}
          />
        }
      />
    </HorizontalContainer>
  )

  oneTimeDividend = () => (
    <VerticalContainer>
      <FormField
        required
        label="Total amount"
        input={this.amountWithTokenAndBalance()}
      />
      <FormField
        label="Reference date"
        hint={<span>The <b>reference date</b> is the date at which a snapshot of all the tokenholder's accounts is taken to determine which tokenholders are qualified for the reward. Disbursement will follow either immediately the reward proposal is processed or whenever the reference date passes.</span>}
        required
        input={
          <DateInput
            name="dateReference"
            value={this.state.dateReference}
            onChange={dateReference => {
              this.setState({ dateReference, })
              this.setErrors({ dateReference })
            }}
            wide
          />
        }
      />
    </VerticalContainer>
  )

  recurringDividend = () => (
    <VerticalContainer>
      <FormField
        required
        label="Amount per disbursement"
        input={this.amountWithTokenAndBalance()}
      />
      {this.startAndEndDate(false)}
      <FormField
        required
        label="Disbursement frequency"
        hint={<span>The <b>disbursement frequency</b> is the time in between each dividend disbursement.</span>}
        input={
          <HorizontalContainer>
            <DisbursementInput
              name="disbursement"
              type="number"
              min={1}
              step={1}
              onChange={e => {
                this.setState({ disbursement: e.target.value })
                this.setDisbursements(
                  this.state.dateStart,
                  this.state.dateEnd,
                  e.target.value,
                  this.state.disbursementUnit,
                )
              }}
              value={this.state.disbursement}
              css="flex: 1"
            />
            <DropDown
              name="disbursementUnit"
              css={{ borderRadius: '0px 4px 4px 0px' }}
              items={DISBURSEMENT_UNITS}
              selected={DISBURSEMENT_UNITS.indexOf(this.state.disbursementUnit)}
              onChange={i => {
                this.setState({ disbursementUnit: DISBURSEMENT_UNITS[i] })
                this.setDisbursements(
                  this.state.dateStart,
                  this.state.dateEnd,
                  this.state.disbursement,
                  DISBURSEMENT_UNITS[i],
                )
              }}
            />
          </HorizontalContainer>
        }
      />
    </VerticalContainer>
  )

  oneTimeMerit = () => (
    <VerticalContainer>
      <FormField
        required
        label="Total amount"
        input={this.amountWithTokenAndBalance()}
      />
      {this.startAndEndDate(true)}
    </VerticalContainer>
  )

  fieldsToDisplay = () => {
    const { rewardType } = this.state
    switch (rewardType) {
    case ONE_TIME_DIVIDEND:
      return this.oneTimeDividend()
    case RECURRING_DIVIDEND:
      return this.recurringDividend()
    case ONE_TIME_MERIT:
      return this.oneTimeMerit()
    default:
      return <div />
    }
  }

  errorBlocks = () => this.state.errors.map(error => (
    <ErrorText key={error}>
      <IconContainer>
        <IconClose
          size="tiny"
          css={{
            marginRight: '8px',
            color: this.props.theme.negative,
          }}
        />
      </IconContainer>
      <Text>{error}</Text>
    </ErrorText>
  ))

  warningBlocks = () => this.state.warnings.map(warning => (
    <ErrorText key={warning}>
      <IconContainer>
        <IconCaution
          size="tiny"
          css={{
            marginRight: '8px',
            color: this.props.theme.warningSurfaceContent,
          }}
        />
      </IconContainer>
      <Text>{warning}</Text>
    </ErrorText>
  ))

  recurringDividendInfo = () => {
    const { disbursement, disbursementUnit, rewardType } = this.state
    return rewardType === 'Recurring Dividend' && (
      <Info>
        The first reward under this policy will be disbursed {disbursement} {disbursementUnit.slice(0, disbursement > 1 ? disbursementUnit.length : -1).toLowerCase()} after 
        your chosen start date, and repeat every {disbursement} {disbursementUnit.slice(0, disbursement > 1 ? disbursementUnit.length : -1).toLowerCase()} until your chosen 
        end date. Dates are approximate as our disbursements occur based on block number.
      </Info>
    )
  }

  showDraft = () => {
    const { rewardType } = this.state
    return (
      <React.Fragment>
        <Form
          onSubmit={this.submitDraft}
          submitText="Continue"
          disabled={!this.isDraftValid()}
          errors={
            <React.Fragment>
              { this.errorBlocks() }
              { this.warningBlocks() }
            </React.Fragment>
          }
        >
          <VerticalSpace />
          <FormField
            label="Description"
            required
            input={
              <TextInput
                name="description"
                wide
                multiline
                placeholder="Briefly describe this reward."
                value={this.state.description}
                onChange={e => this.setState({ description: e.target.value })}
              />
            }
          />
          <FormField
            required
            wide
            label="Reference Asset"
            hint={<span>The <b>reference asset</b> is the token that members will be required to hold in order to receive the reward. For example, if the reference asset is ANT, then any member that holds ANT at the reference date(s) will be eligible to receive the reward. The reference asset is not the token to be paid as reward amount.</span>}
            input={
              <DropDown
                name="referenceAsset"
                wide
                items={this.state.referenceAssets}
                selected={this.state.referenceAssets.indexOf(this.state.referenceAsset)}
                placeholder="Select a token"
                onChange={async (i) => {
                  const referenceAsset = this.state.referenceAssets[i]
                  this.setState({ referenceAsset })
                  if (referenceAsset !== OTHER)
                    await this.verifyTransferable(this.props.app, referenceAsset.key)
                  this.setSemanticErrors({ referenceAsset })
                }}
              />
            }
          />
          {this.state.referenceAsset === OTHER && (
            <React.Fragment>
              <FormField
                label={this.onMainNet() ? this.state.labelCustomToken : 'TOKEN ADDRESS'}
                required
                input={
                  <TextInput
                    name="customToken"
                    placeholder={this.onMainNet() ? 'SYM…' : ''}
                    wide
                    value={this.state.customToken.value}
                    onChange={this.handleCustomTokenChange}
                  />
                }
              />
            </React.Fragment>
          )}
          <FormField
            required
            label="Type"
            hint="Rewards can either be dividends or merits. Dividends are rewards that are distributed based on holding the reference asset at the reference date(s), and they can either be one-time or recurring. Merits can only be one-time, and are based on the newly accrued amount of a particular token over a specified period of time."
            input={
              <DropDown
                wide
                name="rewardType"
                items={REWARD_TYPES}
                selected={REWARD_TYPES.indexOf(rewardType)}
                placeholder="Select type of reward"
                onChange={i => {
                  this.setState({ rewardType: REWARD_TYPES[i] })
                  this.setSemanticErrors({ rewardType: REWARD_TYPES[i] })
                }}
              />
            }
          />
          {this.fieldsToDisplay()}
        </Form>
        { this.isDraftValid() && this.recurringDividendInfo() }
      </React.Fragment>
    )
  }

  showSummary = () => {
    const {
      description,
      rewardType,
      referenceAsset,
      customToken,
      amount,
      amountToken,
      dateReference,
      dateStart,
      dateEnd,
      disbursements,
    } = this.state
    return (
      <VerticalContainer>
        <VerticalSpace />
        <GreyBox>
          <Title>{description}</Title>
          <SubTitle>{rewardType}</SubTitle>
          <Heading>Reference Asset</Heading>
          <Content>
            {referenceAsset === OTHER ? (
              <IdentityBadge
                badgeOnly
                entity={customToken.address}
                shorten
              />
            ): referenceAsset}
          </Content>
          <Heading>
            {rewardType === ONE_TIME_MERIT && 'Total'}
            {' Amount '}
            {rewardType === RECURRING_DIVIDEND && 'per Cycle'}
          </Heading>
          <Content>{amount} {amountToken.symbol}</Content>
          <Heading>
            {rewardType === ONE_TIME_MERIT ?
              'Start and End Date' : 'Disbursement Date'}
            {rewardType === RECURRING_DIVIDEND && 's'}
          </Heading>
          {rewardType === ONE_TIME_DIVIDEND && (
            <Content>{dateReference.toDateString()}</Content>
          )}
          {rewardType === RECURRING_DIVIDEND &&
            disbursements.map((disbursement, i) => (
              <Content key={i}>
                {disbursement.toDateString()}
              </Content>
            ))}
          {rewardType === ONE_TIME_MERIT && (
            <Content>
              {dateStart.toDateString()}{' - '}{dateEnd.toDateString()}
            </Content>
          )}
        </GreyBox>
        <VerticalSpace />
        <Info>
          {rewardType === ONE_TIME_MERIT ?  'Earning the reference asset between the start and end date'
            : 'Holding the reference asset at the disbursement date'
            + (rewardType === 'RECURRING_DIVIDEND' ? 's' : '')
          }

          {' will issue a proportionally split reward across all token holders.'}
        </Info>
        <VerticalSpace />
        <HorizontalContainer>
          <Button
            label="Go back"
            mode="normal"
            css={{ fontWeight: 700, marginRight: '4px' }}
            onClick={() => this.setState({ draftSubmitted: false })}
            wide
          />
          <Button
            label="Submit"
            mode="strong"
            css={{ fontWeight: 700, marginLeft: '4px' }}
            wide
            onClick={this.onSubmit}
          />
        </HorizontalContainer>
      </VerticalContainer>
    )
  }

  render = () => {
    return this.state.draftSubmitted ? this.showSummary() : this.showDraft()
  }
}

const DisbursementInput = styled(TextInput)`
  border-radius: 4px 0 0 4px;
  box-shadow: none;
`

const VerticalContainer = styled.div`
  display: flex;
  flex-direction: column;
`
const HorizontalContainer = styled.div`
  display: flex;
  justify-content: space-between;
`
const VerticalSpace = styled.div`
  height: 24px;
`
const GreyBox = styled.div`
  background-color: #f9fafc;
  border: 1px solid #dde4e9;
  padding: 24px;
  display: flex;
  flex-direction: column;
  border-radius: 4px;
`
const Title = styled(Text).attrs({
  size: 'xlarge',
})``
const SubTitle = styled(Text).attrs({
  size: 'xsmall',
})`
  color: #637381;
  margin-bottom: 8px;
`
const Heading = styled(Text).attrs({
  smallcaps: true,
})`
  color: #637381;
  margin-top: 16px;
  margin-bottom: 8px;
`
const Content = styled(Text).attrs({})``
const ErrorText = styled.div`
  font-size: small;
  display: flex;
  align-items: center;
`
const IconContainer = styled.div`
  display: flex;
`

const NewReward = props => {
  const theme = useTheme()
  return <NewRewardClass theme={theme} {...props} />
}

export default NewReward
