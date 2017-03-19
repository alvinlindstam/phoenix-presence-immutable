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

export const syncState = function (oldState, newState, onChanged) {
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
  }, onChanged)
}

export const syncDiff = function (originalState, {joins, leaves}, onChanged) {
  const immutableJoins = isImmutable(joins) ? joins : Immutable.fromJS(joins)
  const immutableLeaves = isImmutable(leaves) ? leaves : Immutable.fromJS(leaves)

  const stateAfterJoins = immutableJoins.reduce((state, newPresence, key) => {
    const currentPresence = state.get(key)
    if (currentPresence) {
      newPresence = newPresence.set('metas', currentPresence.get('metas').concat(newPresence.get('metas')))
    }
    return state.set(key, newPresence)
  }, originalState)

  const stateAfterLeaves = immutableLeaves.reduce((state, leftPresence, key) => {
    const currentPresence = state.get(key)
    if (!currentPresence) { return state }

    const refsToRemove = leftPresence.get('metas').map(m => m.get('phx_ref'))

    const currentMetas = currentPresence.get('metas').filterNot(p => refsToRemove.includes(p.get('phx_ref')))
    const currentNewPresence = currentPresence.set('metas', currentMetas)
    return currentMetas.size ? state.set(key, currentNewPresence) : state.delete(key)
  }, stateAfterJoins)
  if (!onChanged) {
    return stateAfterLeaves
  }
  const changedKeys = immutableJoins.keySeq().concat(immutableLeaves.keySeq()).toSet()
  return changedKeys.reduce((state, key) => {
    const currentPresence = state.get(key)
    const newPresence = onChanged(key, currentPresence, originalState.get(key))
    if (newPresence && Immutable.is(newPresence.get('metas'), currentPresence.get('metas'))) {
      return state.set(key, newPresence)
    }
    return state
  }, stateAfterLeaves)
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
