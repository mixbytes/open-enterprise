import React, { useState } from 'react'
import { ApolloProvider } from 'react-apollo'

import { useAragonApi } from './api-react'
import {
  Bar,
  Button,
  BackButton,
  Header,
  IconPlus,
  Main,
  Tabs,
} from '@aragon/ui'

import ErrorBoundary from './components/App/ErrorBoundary'
import { Issues, Overview, Settings } from './components/Content'
import { PanelManager, PanelContext, usePanelManagement } from './components/Panel'

import { IdentityProvider } from '../../../shared/identity'

import { STATUS } from './utils/github'
import { initApolloClient } from './utils/apollo-client'
import Unauthorized from './components/Content/Unauthorized'
import { Error } from './components/Card'
import GithubSignin from './GithubSignin'

const App = () => {
  const { api, appState } = useAragonApi()
  const [ activeIndex, setActiveIndex ] = useState(
    { tabIndex: 0, tabData: {} }
  )
  const [ issueDetail, setIssueDetail ] = useState(false)
  const [ githubLoading, setGithubLoading ] = useState(false)
  const [ panel, setPanel ] = useState(null)
  const [ panelProps, setPanelProps ] = useState(null)

  const {
    repos = [],
    bountySettings = {},
    issues = [],
    tokens = [],
    github = { status : STATUS.INITIAL },
  } = appState

  const client = github.token ? initApolloClient(github.token) : null

  const changeActiveIndex = data => {
    setActiveIndex(data)
  }

  const closePanel = () => {
    setPanel(null)
    setPanelProps(null)
  }

  const configurePanel = {
    setActivePanel: p => setPanel(p),
    setPanelProps: p => setPanelProps(p),
  }

  const handleGithubSignIn = () => {
    setGithubLoading(true)
  }

  const handleSelect = index => {
    changeActiveIndex({ tabIndex: index, tabData: {} })
  }

  const handleResolveLocalIdentity = address => {
    return api.resolveAddressIdentity(address).toPromise()
  }

  const handleShowLocalIdentityModal = address => {
    return api
      .requestAddressIdentityModification(address)
      .toPromise()
  }

  const noop = () => {}

  if (githubLoading) {
    return (
      <GithubSignin setGithubLoading={setGithubLoading} />
    )
  } else if (github.status === STATUS.INITIAL) {
    return (
      <Main>
        <Unauthorized onLogin={handleGithubSignIn} />
      </Main>
    )
  } else if (github.status === STATUS.FAILED) {
    return (
      <Main>
        <Error action={noop} />
      </Main>
    )
  }

  // Tabs are not fixed
  const tabs = [{ name: 'Overview', body: Overview }]
  if (repos.length)
    tabs.push({ name: 'Issues', body: Issues })
  tabs.push({ name: 'Settings', body: Settings })

  // Determine current tab details
  const TabComponent = tabs[activeIndex.tabIndex].body
  const TabAction = () => {
    const { setupNewIssue, setupNewProject } = usePanelManagement()

    switch (tabs[activeIndex.tabIndex].name) {
    case 'Overview': return (
      <Button mode="strong" icon={<IconPlus />} onClick={setupNewProject} label="New Project" />
    )
    case 'Issues': return (
      <Button mode="strong" icon={<IconPlus />} onClick={setupNewIssue} label="New Issue" />
    )
    default: return null
    }
  }

  return (
    <Main>
      <ApolloProvider client={client}>
        <PanelContext.Provider value={configurePanel}>
          <IdentityProvider
            onResolve={handleResolveLocalIdentity}
            onShowLocalIdentityModal={handleShowLocalIdentityModal}
          >
            <Header
              primary="Projects"
              secondary={
                <TabAction />
              }
            />

            {issueDetail ?
              <Bar>
                <BackButton
                  onClick={() => {setIssueDetail(false)}}
                />
              </Bar>
              :
              <Tabs
                items={tabs.map(t => t.name)}
                onChange={handleSelect}
                selected={activeIndex.tabIndex}
              />
            }

            <ErrorBoundary>
              <TabComponent
                status={github.status}
                app={api}
                projects={repos}
                bountyIssues={issues}
                bountySettings={bountySettings}
                tokens={tokens}
                activeIndex={activeIndex}
                changeActiveIndex={changeActiveIndex}
                setIssueDetail={setIssueDetail}
                issueDetail={issueDetail}
                onLogin={handleGithubSignIn}
              />
            </ErrorBoundary>

            <PanelManager
              activePanel={panel}
              onClose={closePanel}
              {...panelProps}
            />
          </IdentityProvider>
        </PanelContext.Provider>
      </ApolloProvider>
    </Main>
  )
}

export default App
