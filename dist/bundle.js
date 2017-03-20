'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Immutable = _interopDefault(require('immutable'));

var emptyMap = new Immutable.Map();

// Immutable 4 compatibility
var isImmutable = Immutable.isImmutable || Immutable.Iterable.isIterable;
var coerceImmutable = function coerceImmutable(data) {
  return isImmutable(data) ? data : Immutable.fromJS(data);
};

var isPresenceFormat = function isPresenceFormat(data) {
  return coerceImmutable(data).every(function (presence, key) {
    return presence.has('metas') && presence.get('metas').every(function (meta) {
      return meta.has('phx_ref');
    });
  });
};

// Takes two immutable presence objects and returns all metas in the second that are not in the first
var extractMetas = function extractMetas(comparedPresence, newPresence) {
  var compRefs = comparedPresence.get('metas').map(function (m) {
    return m.get('phx_ref');
  });
  var newMetas = newPresence.get('metas').filterNot(function (m) {
    return compRefs.includes(m.get('phx_ref'));
  });
  return emptyMap.set('metas', newMetas);
};

var syncState = function syncState(oldState, newState, onChanged) {
  newState = Immutable.fromJS(newState);

  var newByDiff = newState.groupBy(function (value, key) {
    return oldState.has(key) ? 'collision' : 'new';
  });
  var inCollisions = newByDiff.get('collision', emptyMap);

  // for all keys found in both oldState and newState, find the metas that are only in one of them
  var onlyInOld = inCollisions.map(function (newPresence, key) {
    return extractMetas(newPresence, oldState.get(key));
  });
  var onlyInNew = inCollisions.map(function (newPresence, key) {
    return extractMetas(oldState.get(key), newPresence);
  });

  var allNewPresences = newByDiff.get('new', emptyMap);
  var notFoundPresences = oldState.filterNot(function (_presence, key) {
    return newState.has(key);
  });

  return syncDiff(oldState, {
    joins: allNewPresences.merge(onlyInNew),
    leaves: notFoundPresences.merge(onlyInOld)
  }, onChanged);
};

var sync = function sync(originalState, newData, onChanged) {
  if (newData.joins && newData.leaves && isPresenceFormat(newData.joins) && isPresenceFormat(newData.leaves)) {
    return syncDiff(originalState, newData, onChanged);
  }
  return syncState(originalState, newData, onChanged);
};

var syncDiff = function syncDiff(originalState, _ref, onChanged) {
  var joins = _ref.joins,
      leaves = _ref.leaves;

  var immutableJoins = coerceImmutable(joins);
  var immutableLeaves = coerceImmutable(leaves);

  var stateAfterJoins = immutableJoins.reduce(function (state, newPresence, key) {
    var currentPresence = state.get(key);
    if (currentPresence) {
      newPresence = newPresence.set('metas', currentPresence.get('metas').concat(newPresence.get('metas')));
    }
    return state.set(key, newPresence);
  }, originalState);

  var stateAfterLeaves = immutableLeaves.reduce(function (state, leftPresence, key) {
    var currentPresence = state.get(key);
    if (!currentPresence) {
      return state;
    }

    var refsToRemove = leftPresence.get('metas').map(function (m) {
      return m.get('phx_ref');
    });

    var currentMetas = currentPresence.get('metas').filterNot(function (p) {
      return refsToRemove.includes(p.get('phx_ref'));
    });
    var currentNewPresence = currentPresence.set('metas', currentMetas);
    return currentMetas.size ? state.set(key, currentNewPresence) : state.delete(key);
  }, stateAfterJoins);

  if (!onChanged) {
    return stateAfterLeaves;
  }
  var changedKeys = immutableJoins.keySeq().concat(immutableLeaves.keySeq()).toSet();
  return changedKeys.reduce(function (state, key) {
    var currentPresence = state.get(key);
    var newPresence = onChanged(key, currentPresence, originalState.get(key));
    if (newPresence && currentPresence && Immutable.is(newPresence.get('metas'), currentPresence.get('metas'))) {
      return state.set(key, newPresence);
    }
    return state;
  }, stateAfterLeaves);
};

var list = function list(state) {
  var chooser = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (key, presence) {
    return presence;
  };

  return state.map(function (value, key) {
    return chooser(key, value);
  }).valueSeq();
};

var emptyState = function emptyState() {
  return emptyMap;
};

var ImmutablePresence = {
  syncState: syncState,
  syncDiff: syncDiff,
  sync: sync,
  list: list,
  emptyState: emptyState
};

exports.syncState = syncState;
exports.sync = sync;
exports.syncDiff = syncDiff;
exports.list = list;
exports.emptyState = emptyState;
exports['default'] = ImmutablePresence;