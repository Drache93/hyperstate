# Hypercube

A type-safe state machine built on top of Hypercore for distributed, append-only state management. Hypercube combines the power of state machines with the reliability and synchronization capabilities of Hypercore, making it perfect for building distributed applications that need consistent state across multiple peers.

Hypercube extends a Duplex stream — write actions in, read state changes out.

## Features

- 🔒 **Type Safety**: Full TypeScript support with automatic type inference
- 🌐 **Distributed**: Built on Hypercore for peer-to-peer state synchronization
- 📝 **Append-Only**: Immutable state history with complete audit trail
- 🎯 **State Machine**: Predictable state transitions with guards and actions
- 🔀 **Streamable**: Duplex stream interface — pipe actions in, pipe state out
- 📦 **Lightweight**: Minimal dependencies, maximum functionality

## Installation

```bash
npm install hypercube
```

## Quick Start

```javascript
import Corestore from "corestore";
import { createMachine, Hypercube } from "hypercube";

// Define your state machine
const definition = createMachine({
  initial: "idle",
  context: {
    running: false,
    counter: 0,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "running",
          action: (ctx, counter) => {
            ctx.running = true;
            ctx.counter = counter;
          },
        },
      },
    },
    running: {
      on: {
        INCREMENT: {
          target: "running",
          action: (ctx) => {
            ctx.counter++;
          },
        },
        STOP: {
          target: "idle",
          action: (ctx, finalCount) => {
            ctx.running = false;
            if (finalCount !== undefined) {
              ctx.counter = finalCount;
            }
          },
        },
      },
    },
  },
});

// Initialize Hypercube
const store = new Corestore("./store");
const cube = new Hypercube(
  store.get({ name: "hypercube", valueEncoding: "json" }),
  definition,
);

// Call action directly
await cube.action("START", 1);
console.log(cube.state, cube.context); // "running", { running: true, counter: 1 }

// Or write actions into the stream
cube.write({ event: "INCREMENT" });

// Read state changes out
cube.on("data", ({ state, context }) => {
  console.log(state, context); // "running", { running: true, counter: 2 }
});
```

## Core Concepts

### State Machine Definition

Define your state machine using the `createMachine` function:

```javascript
const definition = createMachine({
  initial: "stateName",     // Initial state
  context: {                // Shared context object
    // your data here
  },
  states: {
    stateName: {
      on: {
        EVENT_NAME: {
          target: "nextState",
          action: (context, payload) => {
            // Modify context here
          }
        }
      }
    }
  }
});
```

### Duplex Stream Interface

Hypercube is a Duplex stream. The writable side accepts actions, the readable side emits state changes:

```javascript
const cube = new Hypercube(core, definition);

// Write side — type-safe action messages
cube.write({ event: "START", value: 1 });
cube.write({ event: "INCREMENT" });

// Read side — typed state + context
cube.on("data", ({ state, context }) => {
  console.log(state, context);
});

// Pipe it
actionSource.pipe(cube).pipe(stateConsumer);
```

The stream opens lazily on first read or write, restoring the latest state from the underlying Hypercore automatically.

### Actions and Transitions

Actions are functions that modify the context when transitioning between states:

```javascript
action: (context, payload) => {
  // Directly modify the context object
  context.someProperty = payload;
  context.counter++;
}
```

## API Reference

### `createMachine(config)`

Creates a state machine definition.

**Parameters:**
- `config.initial` (string): The initial state name
- `config.context` (object): The initial context/data
- `config.states` (object): State definitions with transitions and actions

**Returns:** Machine definition object

### `new Hypercube(hypercore, definition, opts?)`

Creates a new Hypercube instance (a Duplex stream).

**Parameters:**
- `hypercore`: A Hypercore instance with JSON encoding
- `definition`: Machine definition from `createMachine()`
- `opts.eager` (boolean): If `true`, push the current state immediately on open

### Instance Methods

#### `await cube.action(eventName, payload?)`

Trigger a state transition directly.

**Parameters:**
- `eventName` (string): The event to trigger
- `payload` (any, optional): Data to pass to the action function

**Returns:** `{ state, context }` after the transition

#### `cube.write({ event, value? })`

Write an action into the stream. Equivalent to calling `action()` but through the stream interface, with backpressure handled automatically.

#### `await cube.forward()`

Move forward in the state history.

#### `await cube.backward()`

Move backward in the state history.

#### `cube.truncate(newLength)`

Truncate the underlying Hypercore to a new length.

### Properties

- `cube.state` (string): Current state name
- `cube.context` (object): Current context data
- `cube.isEmpty` (boolean): Whether the hypercore is empty
- `cube.getAvailableActions()` (array): Actions available in the current state

### Stream Events

#### `data`

Emitted when the state changes. Each message contains the new state and context:

```javascript
cube.on("data", ({ state, context }) => {
  console.log(`Now in state: ${state}`, context);
});
```

## Advanced Usage

### Monitoring State Changes

Use the `deep-object-diff` library to track specific changes:

```javascript
import { diff } from "deep-object-diff";

let prev = null;
cube.on("data", ({ state, context }) => {
  if (prev) {
    const changes = diff(prev, context);
    console.log("Changes:", changes);
  }
  prev = structuredClone(context);
});
```

### Distributed State Synchronization

Since Hypercube is built on Hypercore, multiple instances can synchronize automatically:

```javascript
// Peer A
const storeA = new Corestore("./storeA");
const cubeA = new Hypercube(
  storeA.get({ name: "hypercube", valueEncoding: "json" }),
  definition
);

// Peer B
const storeB = new Corestore("./storeB");
const cubeB = new Hypercube(
  storeB.get({ key: storeA.key, valueEncoding: "json" }),
  definition
);
```

### Piping

Since Hypercube is a standard Duplex stream, it composes with the rest of the streaming ecosystem:

```javascript
// Pipe actions from one source into the cube
actionStream.pipe(cube);

// Pipe state changes to a consumer
cube.pipe(renderStream);

// Full pipeline
actionStream.pipe(cube).pipe(renderStream);
```

## Use Cases

- **Distributed Applications**: Synchronize application state across multiple peers
- **Audit Logging**: Maintain immutable history of all state changes
- **Collaborative Tools**: Build real-time collaborative applications
- **IoT Networks**: Coordinate state across distributed IoT devices
- **Blockchain Alternatives**: Create consensus without traditional blockchain overhead

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

---

Built with ❤️ using [Hypercore](https://github.com/holepunchto/hypercore)
