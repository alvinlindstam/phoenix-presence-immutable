'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Immutable = _interopDefault(require('immutable'));

// Phoenix Channels JavaScript client
//
// ## Socket Connection
//
// A single connection is established to the server and
// channels are multiplexed over the connection.
// Connect to the server using the `Socket` class:
//
//     let socket = new Socket("/ws", {params: {userToken: "123"}})
//     socket.connect()
//
// The `Socket` constructor takes the mount point of the socket,
// the authentication params, as well as options that can be found in
// the Socket docs, such as configuring the `LongPoll` transport, and
// heartbeat.
//
// ## Channels
//
// Channels are isolated, concurrent processes on the server that
// subscribe to topics and broker events between the client and server.
// To join a channel, you must provide the topic, and channel params for
// authorization. Here's an example chat room example where `"new_msg"`
// events are listened for, messages are pushed to the server, and
// the channel is joined with ok/error/timeout matches:
//
//     let channel = socket.channel("room:123", {token: roomToken})
//     channel.on("new_msg", msg => console.log("Got message", msg) )
//     $input.onEnter( e => {
//       channel.push("new_msg", {body: e.target.val}, 10000)
//        .receive("ok", (msg) => console.log("created message", msg) )
//        .receive("error", (reasons) => console.log("create failed", reasons) )
//        .receive("timeout", () => console.log("Networking issue...") )
//     })
//     channel.join()
//       .receive("ok", ({messages}) => console.log("catching up", messages) )
//       .receive("error", ({reason}) => console.log("failed join", reason) )
//       .receive("timeout", () => console.log("Networking issue. Still waiting...") )
//
//
// ## Joining
//
// Creating a channel with `socket.channel(topic, params)`, binds the params to
// `channel.params`, which are sent up on `channel.join()`.
// Subsequent rejoins will send up the modified params for
// updating authorization params, or passing up last_message_id information.
// Successful joins receive an "ok" status, while unsuccessful joins
// receive "error".
//
// ## Duplicate Join Subscriptions
//
// While the client may join any number of topics on any number of channels,
// the client may only hold a single subscription for each unique topic at any
// given time. When attempting to create a duplicate subscription,
// the server will close the existing channel, log a warning, and
// spawn a new channel for the topic. The client will have their
// `channel.onClose` callbacks fired for the existing channel, and the new
// channel join will have its receive hooks processed as normal.
//
// ## Pushing Messages
//
// From the previous example, we can see that pushing messages to the server
// can be done with `channel.push(eventName, payload)` and we can optionally
// receive responses from the push. Additionally, we can use
// `receive("timeout", callback)` to abort waiting for our other `receive` hooks
//  and take action after some period of waiting. The default timeout is 5000ms.
//
//
// ## Socket Hooks
//
// Lifecycle events of the multiplexed connection can be hooked into via
// `socket.onError()` and `socket.onClose()` events, ie:
//
//     socket.onError( () => console.log("there was an error with the connection!") )
//     socket.onClose( () => console.log("the connection dropped") )
//
//
// ## Channel Hooks
//
// For each joined channel, you can bind to `onError` and `onClose` events
// to monitor the channel lifecycle, ie:
//
//     channel.onError( () => console.log("there was an error!") )
//     channel.onClose( () => console.log("the channel has gone away gracefully") )
//
// ### onError hooks
//
// `onError` hooks are invoked if the socket connection drops, or the channel
// crashes on the server. In either case, a channel rejoin is attempted
// automatically in an exponential backoff manner.
//
// ### onClose hooks
//
// `onClose` hooks are invoked only in two cases. 1) the channel explicitly
// closed on the server, or 2). The client explicitly closed, by calling
// `channel.leave()`
//
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

var emptyMap = new Immutable.Map();

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

var Presence = {
  syncState: function syncState(oldState, newState, onJoin, onLeave) {
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

    return this.syncDiff(oldState, {
      joins: allNewPresences.merge(onlyInNew),
      leaves: notFoundPresences.merge(onlyInOld)
    }, onJoin, onLeave);
  },
  syncDiff: function syncDiff(state, _ref, onJoin, onLeave) {
    var joins = _ref.joins,
        leaves = _ref.leaves;

    var immutableJoins = Immutable.isCollection(joins) ? joins : Immutable.fromJS(joins);
    var immutableLeaves = Immutable.isCollection(leaves) ? leaves : Immutable.fromJS(leaves);

    state = immutableJoins.reduce(function (state, newPresence, key) {
      var currentPresence = state.get(key);
      if (currentPresence) {
        newPresence = newPresence.set('metas', currentPresence.get('metas').concat(newPresence.get('metas')));
      }
      if (onJoin) {
        onJoin(key, currentPresence, newPresence);
      }
      return state.set(key, newPresence);
    }, state);

    return immutableLeaves.reduce(function (state, leftPresence, key) {
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
      if (onLeave) {
        onLeave(key, currentNewPresence, leftPresence);
      }
      return currentMetas.size ? state.set(key, currentNewPresence) : state.delete(key);
    }, state);
  },
  list: function list(state) {
    var chooser = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : function (key, presence) {
      return presence;
    };

    return state.map(function (value, key) {
      return chooser(key, value);
    }).valueSeq();
  }
};

exports.Presence = Presence;