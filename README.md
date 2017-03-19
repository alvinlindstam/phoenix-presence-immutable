[![npm version](https://badge.fury.io/js/phoenix-presence-immutable.svg)](https://badge.fury.io/js/phoenix-presence-immutable)


# phoenix-presence-immutable

Helper library for managing Phoenix Presence state using Immutable.js.

## Usage

`npm install phoenix-presence-immutable`

```javascript
import ImmutablePresence from 'phoenix-presence-immutable'


// Assuming we're using a React component
this.setState({presenceState: ImmutablePresence.emptyState()})

// receive initial presence data from server, sent after join
myChannel.on("presence_state", newState => {
  this.setState((oldState) => {
    return {presenceState: ImmutablePresence.syncState(oldState.presenceState, newState)}
  })
})

// receive "presence_diff" from server, containing join/leave events
myChannel.on("presence_diff", diff => {
  this.setState((oldState) => {
    return {presenceState: ImmutablePresence.syncDiff(oldState.presenceState, diff)}
  })
})
```

## Documentation

### `emptyState()`
Returns an empty state object. Use this as your first state and before letting
`syncState` and `syncDiff` use it for their updates.

### `syncState(oldState, newState, onJoin, onLeave)`
`ImmutablePresence.syncState` is used to sync the list of presences on the server
with the client's state. `oldState` is the the current presence state, and `newState`
should be the new state provided by the server (in normal JS format, not as Immutable.js 
data structures)

`onJoin` and `onLeave` are optional callbacks.

### `syncDiff(oldState, diff, onJoin, onLeave)`
`ImmutablePresence.syncDiff` is used to sync a diff of presence join and leave
events from the server, as they happen. `oldState` is the current presence state, and
`diff` is the diff data provided by the server.

`onJoin` and `onLeave` are optional callbacks.

### `list(presenceState, listBy)`
`Presence.list` is used to return a sequence of presence information
based on the local state of metadata. By default, all presence
metadata is returned, but a `listBy` function can be supplied to
allow the client to select which metadata to use for a given presence.
For example, you may have a user online from different devices with
a metadata status of "online", but they have set themselves to "away"
on another device. In this case, they app may choose to use the "away"
status for what appears on the UI. The example below defines a `listBy`
function which prioritizes the first metadata which was registered for
each user. This could be the first tab they opened, or the first device
they came online from:

    // Extracting user data. The chooser function will pick data from the presence metas. 
    const listBy = (id, presence) => {
      const metas = presence.get('metas')
      return metas.first().set('id', id).set('count', metas.size)
    }
    // onlineUsers will be an Immutable.Seq
    let onlineUsers = ImmutablePresence.list(presenceState, listBy)
    

### <a name="onJoin"></a>`onJoin()` and `onLeave()` callbacks
The optional `onJoin` and `onLeave` callbacks can
be provided to react to changes in the client's local presences across
disconnects and reconnects with the server.

`onJoin` is called with the arguments `key`, `oldPresence`, `newPresence`.
`oldPresence` may be undefined if the user was not already present.

`onJoin` is called with the arguments `key`, `newPresence`, `oldPresence`.
`newPresence.get('metas')` will contain all presence metas that are not yet
disconnected, and will be empty if the presence was removed altogether.

These functions are called once for each new or removed meta object, so a single
call to `syncState` or `syncDiff` may result in multiple calls to the callbacks
with the same key. Assuming the current state is empty, and `syncState` is called
with `{alvin: {metas: [{device: "desktop", phx_ref: '1'}, {device: "mobile", phx_ref: '2'}]}}`,
`onJoin` would be called twice:
 
```javascript
onJoin('alvin', undefined, fromJS({metas: [{device: "desktop", phx_ref: '1'}]}));
onJoin('alvin', fromJS({metas: [{device: "desktop", phx_ref: '1'}]}), fromJS({metas: [{device: "desktop", phx_ref: '1'}, {device: "mobile", phx_ref: '2'}]}));
```

#### Example callback usage
```
// detect if user has joined for the 1st time or from another tab/device
let onJoin = (id, oldPresence, newPresence) => {
  if(!oldPresence){
    console.log("user has entered for the first time", newPresence)
  } else {
    console.log("user additional presence", newPresence)
  }
}
// detect if user has left from all tabs/devices, or is still present
let onLeave = (id, newPresence, oldPresence) => {
  if(newPresence.get('metas').size === 0){
    console.log("user has left from all devices", oldPresence)
  } else {
    console.log("user left from a device", oldPresence)
  }
}   
```

## Data structure

The state maintained is a simple mapping from Phoenix's standard presence format
and Immutable.js.

### Top level map
The top level data structure is an Immutable.Map, where the keys are the key used for
Phoenix.Presence.track on the server. The values are the presence objects.

To get the total number of presences, use `presenceState.size`. 

### Presence objects
For each key, there is a single presence object. It is an Immutable.Map, and it
has a single key: "metas" which is an Immutable.Collection.

### Metas
For each present key, there will be at least one but possible many meta objects.
The meta objects each represent a single presence for the given key. A common 
pattern is using user ids as keys, where each user may be present on multiple
devices and tabs with different metadata on each.

Each meta object is an Immutable.Map, and will at the very least have the key
`phx_ref` which is used internally. It may also contain any other keys defined
as metadata on the tracked presence.
