// Phoenix Channels JavaScript client
//
// ## Presence
//
// The `Presence` object provides features for syncing presence information
// from the server with the client and handling presences joining and leaving.
//
// ### Syncing initial state from the server
//
// `Presence.syncState` is used to sync the list of presences on the server
// with the client's state. An optional `onJoin` and `onLeave` callback can
// be provided to react to changes in the client's local presences across
// disconnects and reconnects with the server.
//
// `Presence.syncDiff` is used to sync a diff of presence join and leave
// events from the server, as they happen. Like `syncState`, `syncDiff`
// accepts optional `onJoin` and `onLeave` callbacks to react to a user
// joining or leaving from a device.
//
// ### Listing Presences
//
// `Presence.list` is used to return a list of presence information
// based on the local state of metadata. By default, all presence
// metadata is returned, but a `listBy` function can be supplied to
// allow the client to select which metadata to use for a given presence.
// For example, you may have a user online from different devices with
// a metadata status of "online", but they have set themselves to "away"
// on another device. In this case, they app may choose to use the "away"
// status for what appears on the UI. The example below defines a `listBy`
// function which prioritizes the first metadata which was registered for
// each user. This could be the first tab they opened, or the first device
// they came online from:
//
//     let state = {}
//     state = Presence.syncState(state, stateFromServer)
//     let listBy = (id, {metas: [first, ...rest]}) => {
//       first.count = rest.length + 1 // count of this user's presences
//       first.id = id
//       return first
//     }
//     let onlineUsers = Presence.list(state, listBy)
//
//
// ### Example Usage
//
//     // detect if user has joined for the 1st time or from another tab/device
//     let onJoin = (id, current, newPres) => {
//       if(!current){
//         console.log("user has entered for the first time", newPres)
//       } else {
//         console.log("user additional presence", newPres)
//       }
//     }
//     // detect if user has left from all tabs/devices, or is still present
//     let onLeave = (id, current, leftPres) => {
//       if(current.metas.length === 0){
//         console.log("user has left from all devices", leftPres)
//       } else {
//         console.log("user left from a device", leftPres)
//       }
//     }
//     let presences = {} // client's initial empty presence state
//     // receive initial presence data from server, sent after join
//     myChannel.on("presence_state", state => {
//       presences = Presence.syncState(presences, state, onJoin, onLeave)
//       displayUsers(Presence.list(presences))
//     })
//     // receive "presence_diff" from server, containing join/leave events
//     myChannel.on("presence_diff", diff => {
//       presences = Presence.syncDiff(presences, diff, onJoin, onLeave)
//       this.setState({users: Presence.list(room.presences, listBy)})
//     })
//

import Immutable from 'immutable'

const emptyMap = new Immutable.Map()

// Immutable 4 compatibility
const isImmutable = Immutable.isImmutable || Immutable.Iterable.isIterable

// Takes two immutable presence objects and returns all metas in the second that are not in the first
const extractMetas = (comparedPresence, newPresence) => {
  const compRefs = comparedPresence.get('metas').map(m => m.get('phx_ref'))
  const newMetas = newPresence.get('metas').filterNot(m => compRefs.includes(m.get('phx_ref')))
  return emptyMap.set('metas', newMetas)
}

export const syncState = function (oldState, newState, onJoin, onLeave) {
  newState = Immutable.fromJS(newState)

  const newByDiff = newState.groupBy((value, key) => oldState.has(key) ? 'collision' : 'new')
  const inCollisions = newByDiff.get('collision', emptyMap)

    // for all keys found in both oldState and newState, find the metas that are only in one of them
  const onlyInOld = inCollisions.map((newPresence, key) => extractMetas(newPresence, oldState.get(key)))
  const onlyInNew = inCollisions.map((newPresence, key) => extractMetas(oldState.get(key), newPresence))

  const allNewPresences = newByDiff.get('new', emptyMap)
  const notFoundPresences = oldState.filterNot((_presence, key) => newState.has(key))

  return syncDiff(oldState, {
    joins: allNewPresences.merge(onlyInNew),
    leaves: notFoundPresences.merge(onlyInOld)
  }, onJoin, onLeave)
}

export const syncDiff = function (state, {joins, leaves}, onJoin, onLeave) {
  const immutableJoins = isImmutable(joins) ? joins : Immutable.fromJS(joins)
  const immutableLeaves = isImmutable(leaves) ? leaves : Immutable.fromJS(leaves)

  state = immutableJoins.reduce((state, newPresence, key) => {
    const currentPresence = state.get(key)
    if (currentPresence) {
      newPresence = newPresence.set('metas', currentPresence.get('metas').concat(newPresence.get('metas')))
    }
    if (onJoin) { onJoin(key, currentPresence, newPresence) }
    return state.set(key, newPresence)
  }, state)

  return immutableLeaves.reduce((state, leftPresence, key) => {
    const currentPresence = state.get(key)
    if (!currentPresence) { return state }

    const refsToRemove = leftPresence.get('metas').map(m => m.get('phx_ref'))

    const currentMetas = currentPresence.get('metas').filterNot(p => refsToRemove.includes(p.get('phx_ref')))
    const currentNewPresence = currentPresence.set('metas', currentMetas)
    if (onLeave) { onLeave(key, currentNewPresence, leftPresence) }
    return currentMetas.size ? state.set(key, currentNewPresence) : state.delete(key)
  }, state)
}

export const list = function (state, chooser = (key, presence) => presence) {
  return state.map((value, key) => {
    return chooser(key, value)
  }).valueSeq()
}

export const emptyState = () => emptyMap

const ImmutablePresence = {
  syncState: syncState,
  syncDiff: syncDiff,
  list: list,
  emptyState: emptyState
}

export default ImmutablePresence
