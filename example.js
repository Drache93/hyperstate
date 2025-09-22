import Corestore from "corestore";
import { createMachine, Hyperstate } from "./dist/index";
import { diff } from "deep-object-diff";

// Example usage - all types are automatically inferred!
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

const store = new Corestore("./store");
const hyperstate = new Hyperstate(
  store.get({ name: "hyperstate", valueEncoding: "json" }),
  definition,
);

await hyperstate.ready();

if (hyperstate.isEmpty) {
  await hyperstate.action("START", 1);
}

hyperstate.on("stateChange", ({ newState, oldState }) => {
  const stateDiff = diff(oldState, newState);
  console.log("State changed:", stateDiff);

  const data = Buffer.from(JSON.stringify(stateDiff));

  // Send to your app
});

console.log(hyperstate.state, hyperstate.context);

await hyperstate.action("INCREMENT");
console.log(hyperstate.state, hyperstate.context);
await hyperstate.action("STOP");
console.log(hyperstate.state, hyperstate.context);
await hyperstate.action("STOP", 42);
console.log(hyperstate.state, hyperstate.context);
await hyperstate.action("STOP", 42);
console.log(hyperstate.state, hyperstate.context);
