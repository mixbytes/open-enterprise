import { castVote, executeVote, startVote } from './votes'
import { hasLoadedVoteSettings, loadVoteSettings } from '../utils/vote-settings'

export const handleEvent = async (state, event) => {
  const {
    event: eventName,
    returnValues: returnValues,
  } = event
  let nextState = {
    ...state,
    ...(!hasLoadedVoteSettings(state) ? await loadVoteSettings() : {}),
  }
  switch (eventName) {
  case 'SYNC_STATUS_SYNCING': {
    nextState = {
      ...nextState,
      isSyncing: true,
    }
    break
  }
  case 'SYNC_STATUS_SYNCED': {
    nextState = {
      ...nextState,
      isSyncing: false,
    }
    break
  }
  case 'CastVote':
    nextState = await castVote(nextState, returnValues)
    break
  case 'ExecutionScript':
    break
  case 'ExecuteVote':
    nextState = await executeVote(nextState, returnValues)
    break
  case 'StartVote':
    nextState = await startVote(nextState, returnValues)
    break
  case 'UpdateQuorum':
  case 'UpdateMinimumSupport':
  default:
    break
  }
  return nextState
}
