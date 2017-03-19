import assert from 'assert'

import Presence, {syncDiff, syncState, list} from '../src/index.js'
import Immutable, {Map, fromJS} from 'immutable'

const isImmutable = Immutable.isImmutable || Immutable.Iterable.isIterable

const assertImmutableEquals = (expected, actual) => {
  // Test using Immutables equals method
  assert(isImmutable(expected))
  assert(isImmutable(actual))
  if (!expected.equals(actual)) {
    // Produce readable diffs
    assert.deepEqual(expected.toJS(), actual.toJS())
    // failsafe, if toJS somehow was equals
    assert(expected.equals(actual))
  }
}
let fixtures = {
  joins () {
    return {u1: {metas: [{id: 1, phx_ref: '1.2'}]}}
  },
  leaves () {
    return {u2: {metas: [{id: 2, phx_ref: '2'}]}}
  },
  state: fromJS({
    u1: {metas: [{id: 1, phx_ref: '1'}]},
    u2: {metas: [{id: 2, phx_ref: '2'}]},
    u3: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.2'}]}
  })
}

describe('exports', () => {
  it('all functions are available on default export and as individual functions', () => {
    assert(Object.is(Presence.list, list))
    assert(Object.is(Presence.syncState, syncState))
    assert(Object.is(Presence.syncDiff, syncDiff))
  })
})

describe('syncState', () => {
  it('syncs empty state', () => {
    const newStateData = {u1: {metas: [{id: 1, phx_ref: '1'}]}}
    const state = new Map()
    const newState = Presence.syncState(state, newStateData)
    assert.deepEqual(state, new Map())
    assertImmutableEquals(fromJS(newStateData), newState)
  })

  it("onJoins new presences and onLeave's left presences", () => {
    const newState = fixtures.state
    const state = fromJS({u4: {metas: [{id: 4, phx_ref: '4'}]}})
    let joined = {}
    let left = {}
    const onJoin = (key, current, newPres) => {
      joined[key] = {current: current && current.toJS(), newPres: newPres.toJS()}
    }
    const onLeave = (key, current, leftPres) => {
      left[key] = {current: current && current.toJS(), leftPres: leftPres.toJS()}
    }
    const syncedState = Presence.syncState(state, newState, null, onJoin, onLeave)
    assertImmutableEquals(newState, syncedState)
    assert.deepEqual(joined, {
      u1: {current: null, newPres: {metas: [{id: 1, phx_ref: '1'}]}},
      u2: {current: null, newPres: {metas: [{id: 2, phx_ref: '2'}]}},
      u3: {current: null, newPres: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.2'}]}}
    })
    assert.deepEqual(left, {
      u4: {current: {metas: []}, leftPres: {metas: [{id: 4, phx_ref: '4'}]}}
    })
  })

  it("calls onChanged as expected", () => {
    const newState = fixtures.state
    const state = fromJS({u1: {metas: [{id: 1, phx_ref: 'other'}]}, u4: {metas: [{id: 4, phx_ref: '4'}]}})
    const changed = {}
    const onChanged = (key, newPresence, oldPresence) => {
      assert(changed[key] == undefined)
      changed[key] = {
        new: newPresence && newPresence.toJS(),
        old: oldPresence && oldPresence.toJS(),
      }
    }

    const syncedState = Presence.syncState(state, newState, onChanged)
    assertImmutableEquals(newState, syncedState)
    assert.deepEqual(changed, {
      u1: {old: {metas: [{id: 1, phx_ref: 'other'}]}, new: {metas: [{id: 1, phx_ref: '1'}]}},
      u2: {old: undefined, new: {metas: [{id: 2, phx_ref: '2'}]}},
      u3: {old: undefined, new: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.2'}]}},
      u4: {old: {metas: [{id: 4, phx_ref: '4'}]}, new: undefined}
    })
  })

  it('onJoins only newly added metas', () => {
    const newState = fromJS({u3: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.new'}]}})
    const state = fromJS({u3: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.old'}]}})
    const joined = {}
    const left = {}
    const onJoin = (key, current, newPres) => {
      joined[key] = {current: current && current.toJS(), newPres: newPres.toJS()}
    }
    const onLeave = (key, current, leftPres) => {
      left[key] = {current: current && current.toJS(), leftPres: leftPres.toJS()}
    }
    const syncedState = Presence.syncState(state, newState, null, onJoin, onLeave)
    assertImmutableEquals(newState, syncedState)
    assert.deepEqual({
      u3: {
        current: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.old'}]},
        newPres: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.old'}, {id: 3, phx_ref: '3.new'}]}
      }
    }, joined)
    assert.deepEqual({
      u3: {
        leftPres: {metas: [{id: 3, phx_ref: '3.old'}]},
        current: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.new'}]}
      }
    }, left)
  })
})

describe('syncDiff', () => {
  it('does nothing without leaves or joins', () => {
    const state = new Map()
    const newState = Presence.syncDiff(state, {joins: {}, leaves: {}})
    assertImmutableEquals(state, newState)
    // It should be the same object that is returned on no changes
    assert(Object.is(state, newState))
  })

  it('syncs empty state', () => {
    let joins = {u1: {metas: [{id: 1, phx_ref: '1'}]}}
    const oldState = new Map()
    const newState = Presence.syncDiff(oldState, {joins: joins, leaves: {}})

    assert(!Object.is(newState, oldState))
    assertImmutableEquals(fromJS(joins), newState)
  })

  it('adds additional meta', () => {
    const state = fixtures.state
    const newState = Presence.syncDiff(state, {joins: fixtures.joins(), leaves: {}})
    assertImmutableEquals(
      fromJS({
        u1: {metas: [{id: 1, phx_ref: '1'}, {id: 1, phx_ref: '1.2'}]},
        u2: {metas: [{id: 2, phx_ref: '2'}]},
        u3: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.2'}]}
      }),
      newState
    )
    // Non changed items should have the same identity
    assert(Object.is(newState.get('u2'), state.get('u2')))
    assert(Object.is(newState.get('u3'), state.get('u3')))
    assert(!Object.is(newState.get('u1'), state.get('u1')))
    assert(Object.is(
      newState.get('u1').get('metas').first(),
      state.get('u1').get('metas').first()
    ))
  })

  it('removes presence when meta is empty and adds additional meta', () => {
    let state = fixtures.state
    const newState = Presence.syncDiff(state, {joins: fixtures.joins(), leaves: fixtures.leaves()})

    assertImmutableEquals(
      fromJS({
        u1: {metas: [{id: 1, phx_ref: '1'}, {id: 1, phx_ref: '1.2'}]},
        u3: {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.2'}]}
      }),
      newState
    )
    // Non changed items should have the same identity
    assert(Object.is(newState.get('u3'), state.get('u3')))
    assert(!Object.is(newState.get('u1'), state.get('u1')))
    assert(Object.is(
      newState.get('u1').get('metas').first(),
      state.get('u1').get('metas').first()
    ))
  })

  it('removes meta while leaving key if other metas exist', () => {
    const state = fromJS({
      u1: {metas: [{id: 1, phx_ref: '1'}, {id: 1, phx_ref: '1.2'}]}
    })
    const newState = Presence.syncDiff(state, {joins: {}, leaves: {u1: {metas: [{id: 1, phx_ref: '1'}]}}})
    const expected = fromJS({
      u1: {metas: [{id: 1, phx_ref: '1.2'}]}
    })
    assertImmutableEquals(expected, newState)
    // Non changed items should have the same identity
    assert(!Object.is(newState.get('u1'), state.get('u1')))
    assert(Object.is(
      newState.get('u1').get('metas').first(),
      state.get('u1').get('metas').last()
    ))
  })
})

describe('list', () => {
  it('lists full presence by default', () => {
    const state = fixtures.state
    const expected = fromJS([
      {metas: [{id: 1, phx_ref: '1'}]},
      {metas: [{id: 2, phx_ref: '2'}]},
      {metas: [{id: 3, phx_ref: '3'}, {id: 3, phx_ref: '3.2'}]}
    ])
    assertImmutableEquals(expected, Presence.list(state))
  })

  it('lists with custom function', () => {
    let state = fromJS({u1: {metas: [
      {id: 1, phx_ref: '1.first'},
      {id: 1, phx_ref: '1.second'}]
    }})

    assertImmutableEquals(
      fromJS([{id: 1, phx_ref: '1.first'}]),
      Presence.list(state, (_key, value) => value.get('metas').first())
    )
  })
})
