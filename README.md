# Hyperstate

A type-safe state machine built on top of Hypercore for distributed, append-only state management. Hyperstate combines the power of state machines with the reliability and synchronization capabilities of Hypercore, making it perfect for building distributed applications that need consistent state across multiple peers.

## Features

- 🔒 **Type Safety**: Full TypeScript support with automatic type inference
- 🌐 **Distributed**: Built on Hypercore for peer-to-peer state synchronization
- 📝 **Append-Only**: Immutable state history with complete audit trail
- 🎯 **State Machine**: Predictable state transitions with guards and actions
- 🔄 **Event-Driven**: React to state changes with built-in event emitters
- 📦 **Lightweight**: Minimal dependencies, maximum functionality

## Installation

```bash
npm install hyperstate
```

## Quick Start

```javascript
import Corestore from "corestore";
import { createMachine, Hyperstate } from "hyperstate";

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

// Initialize Hyperstate
const store = new Corestore("./store");
const hyperstate = new Hyperstate(
  store.get({ name: "hyperstate", valueEncoding: "json" }),
  definition,
);

await hyperstate.ready();

// Use the state machine
await hyperstate.action("START", 1);
console.log(hyperstate.state, hyperstate.context); // "running", { running: true, counter: 1 }

await hyperstate.action("INCREMENT");
console.log(hyperstate.state, hyperstate.context); // "running", { running: true, counter: 2 }
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

### `new Hyperstate(hypercore, definition)`

Creates a new Hyperstate instance.

**Parameters:**
- `hypercore`: A Hypercore instance with JSON encoding
- `definition`: Machine definition from `createMachine()`

### Instance Methods

#### `await hyperstate.ready()`

Wait for the Hyperstate instance to be ready for use.

#### `await hyperstate.action(eventName, payload?)`

Trigger a state transition.

**Parameters:**
- `eventName` (string): The event to trigger
- `payload` (any, optional): Data to pass to the action function

#### Properties

- `hyperstate.state` (string): Current state name
- `hyperstate.context` (object): Current context data
- `hyperstate.isEmpty` (boolean): Whether the hypercore is empty

### Events

#### `stateChange`

Emitted when the state changes.

```javascript
hyperstate.on("stateChange", ({ newState, oldState }) => {
  console.log(`State changed from ${oldState} to ${newState}`);
});
```

## Advanced Usage

### Monitoring State Changes

Use the `deep-object-diff` library to track specific changes:

```javascript
import { diff } from "deep-object-diff";

hyperstate.on("stateChange", ({ newState, oldState }) => {
  const stateDiff = diff(oldState, newState);
  console.log("Changes:", stateDiff);

  // Send changes to your application
  const data = Buffer.from(JSON.stringify(stateDiff));
  // ... handle the diff
});
```

This approach lets you send just the changes to your application, rather than the entire state.

### Distributed State Synchronization

Since Hyperstate is built on Hypercore, multiple instances can synchronize automatically:

```javascript
// Peer A
const storeA = new Corestore("./storeA");
const hyperstateA = new Hyperstate(
  storeA.get({ name: "hyperstate", valueEncoding: "json" }),
  definition
);

// Peer B
const storeB = new Corestore("./storeB");
const hyperstateB = new Hyperstate(
  storeB.get({ key: storeA.key, valueEncoding: "json" }),
  definition
);

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
