import PropTypes from 'prop-types'
import React from 'react'
import styled from 'styled-components'

import {
  Button,
  DropDown,
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
import {
  millisecondsToBlocks,
  MILLISECONDS_IN_A_DAY,
  MILLISECONDS_IN_A_WEEK,
  MILLISECONDS_IN_A_YEAR,
  MILLISECONDS_IN_A_MONTH,
} from '../../../../../../shared/ui/utils'
import moment from 'moment'
import { isBefore } from 'date-fns'
import { BigNumber } from 'bignumber.js'
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
  disbursementBlocks: Array(50).fill('loading...'),
  currentBlockNumber: 0,
  draftSubmitted: false,
  errors: [],
  warnings: [],
}

const getBlockProps = (state, currentBlock) => {
  const {
    amount,
    amountToken,
    rewardType,
    dateReference,
    dateStart,
    dateEnd,
    disbursement,
    disbursementUnit,
    disbursements,
  } = state
  const BLOCK_PADDING = 1
  const amountBN = new BigNumber(amount)
  const tenBN =  new BigNumber(10)
  const decimalsBN = new BigNumber(amountToken.decimals)
  const amountWei = amountBN.times(tenBN.pow(decimalsBN))
  let startBlock = currentBlock + millisecondsToBlocks(Date.now(), dateStart)
  let occurrences, isMerit, duration
  if (rewardType === ONE_TIME_DIVIDEND || rewardType === ONE_TIME_MERIT) {
    occurrences = 1
  }
  if (rewardType === ONE_TIME_MERIT) {
    isMerit = true
    duration = millisecondsToBlocks(dateStart, dateEnd)
  } else {
    isMerit = false
  }
  if (rewardType === RECURRING_DIVIDEND) {
    occurrences = disbursements.length
    switch (disbursementUnit) {
    case 'Days':
      duration = millisecondsToBlocks(Date.now(), disbursement * MILLISECONDS_IN_A_DAY + Date.now())
      break
    case 'Weeks':
      duration = millisecondsToBlocks(Date.now(), disbursement * MILLISECONDS_IN_A_WEEK + Date.now())
      break
    case 'Years':
      duration = millisecondsToBlocks(Date.now(), disbursement * MILLISECONDS_IN_A_YEAR + Date.now())
      break
    default:
      duration = millisecondsToBlocks(Date.now(), disbursement * MILLISECONDS_IN_A_MONTH + Date.now())
    }
    startBlock -= duration
  }
  if(rewardType === ONE_TIME_DIVIDEND){
    const rawBlockDuration = millisecondsToBlocks(Date.now(), dateReference)
    startBlock = dateReference <= new Date() ? currentBlock + rawBlockDuration - BLOCK_PADDING : currentBlock 
    duration = dateReference <= new Date() ? BLOCK_PADDING : rawBlockDuration
  }
  return [ isMerit, amountWei, startBlock, duration, occurrences ]
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
    let date = moment(dateStart), disbursements = []
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
          wide={true}
          value={this.state.amount}
          css={{ borderRadius: '4px 0px 0px 4px' }}
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

  startAndEndDate = () => (
    <HorizontalContainer>
      <FormField
        label="Start date"
        required
        input={
          <DateInput
            name="dateStart"
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
        required
        input={
          <DateInput
            name="dateEnd"
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
      {this.startAndEndDate()}
      <FormField
        required
        label="Disbursement frequency"
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
              wide={true}
              value={this.state.disbursement}
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
      {this.startAndEndDate()}
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

  showDraft = () => {
    const { rewardType } = this.state
    return (
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
          help="hey"
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
                this.setErrors({ referenceAsset })
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
          input={
            <DropDown
              wide
              name="rewardType"
              items={REWARD_TYPES}
              selected={REWARD_TYPES.indexOf(rewardType)}
              placeholder="Select type of reward"
              onChange={i => {
                this.setState({ rewardType: REWARD_TYPES[i] })
                this.setErrors({ rewardType: REWARD_TYPES[i] })
              }}
            />
          }
        />
        {this.fieldsToDisplay()}
      </Form>
    )
  }

  setDisbursementBlocks = currentBlockNumber => {
    if (currentBlockNumber === this.state.currentBlockNumber)
      return
    const [
      isMerit,
      amountWei,
      startBlock,
      duration,
      occurrences,
    ] = getBlockProps(this.state, currentBlockNumber)
    const disbursementBlocks = []
    for (let i = 1; i <= occurrences; i ++) {
      const block = startBlock + duration * i
      disbursementBlocks.push(block)
    }
    this.setState({
      currentBlockNumber,
      isMerit,
      amountWei,
      startBlock,
      duration,
      occurrences,
      disbursementBlocks,
    })
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
      disbursementBlocks,
    } = this.state
    this.props.app.web3Eth('getBlockNumber')
      .subscribe(this.setDisbursementBlocks)
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
                {disbursement.toDateString()} (block: {disbursementBlocks[i]})
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
