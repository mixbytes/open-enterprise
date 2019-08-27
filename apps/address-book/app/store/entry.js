import { ipfsGet } from '../../../../shared/utils/ipfs'
import { app } from './app'
/// /////////////////////////////////////
/*     AddressBook event handlers      */
/// /////////////////////////////////////

export const onEntryAdded = async ({ entries = [] }, { addr }) => {
  // is addr already in the state?
  if (entries.some(entry => entry.addr === addr)) {
    // entry already cached, do nothing
  } else {
    // entry not cached
    const data = await loadEntryData(addr) // async load data from contract
    if (data) { // just perform transform and push if data was found (entry was not removed)
      const entry = { addr, data } // transform for the frontend to understand
      entries.push(entry) // add to the state object received as param
    }
  }
  // return the (un)modified entries array
  return entries
}

export const onEntryRemoved = async ({ entries }, { addr }) => {
  const removeIndex = entries.findIndex(entry => entry.addr === addr)
  if (removeIndex > -1) {
    // entry already cached, remove from state
    entries.splice(removeIndex, 1)
  }
  // return the (un)modified entries array
  return entries
}

export const onEntryUpdated = async ({ entries = [] }, { addr }) => {
  const index = entries.indexOf(entry => entry.addr === addr)

  if (index) {
    const data = await loadEntryData(addr) // async load data from contract
    if (data) { // just perform transform if data was found (entry was not subsequently removed)
      const entry = { addr, data }
      entries[index] = entry
    }
  } else {
    onEntryAdded({ entries }, { addr })
  }

  // return the (un)modified entries array
  return entries
}

/// /////////////////////////////////////
/*    AddressBook helper functions    */
/// /////////////////////////////////////

const loadEntryData = (addr) => {
  return new Promise((resolve, reject) => {
    app.call('getEntry', addr).subscribe(async cid => {
      if (!cid) resolve() // entry probably removed in a future block
      try {
        const entry = await ipfsGet(cid)
        resolve(entry)
      } catch (error) {
        console.error(error) // TODO: incorporate this info into the errorCode & errorMessage below!!
        reject({
          caughtError: error,
          errorCode: 'ipfs_resolution_error',
          errorMessage: 'could not resolve ipfs blah blah blah; fix this error message in apps/address-book/app/store/entry.js',
        })
      }
    })
  })
}
