import {
  createMachine,
  Punchcard,
  inferActions,
  MachineConfig,
} from "../index";
import { expectType } from "tsd";

// Test 1: Basic context type inference
const basicMachine = createMachine({
  initial: "idle" as const,
  context: {
    count: 0,
    name: "test",
    active: false,
  },
  states: {
    idle: {
      on: {
        START: {
          target: "running",
          action: (ctx, initialCount: number) => {
            // TypeScript should know exact types here
            expectType<number>(ctx.count);
            expectType<string>(ctx.name);
            expectType<boolean>(ctx.active);

            ctx.count = initialCount;
            ctx.active = true;
            // This should cause a type error:
            // ctx.invalidProp = 'invalid';
          },
        },
      },
    },
    running: {
      on: {
        INCREMENT: {
          target: "running",
          action: (ctx) => {
            expectType<number>(ctx.count);
            ctx.count++;
          },
        },
        STOP: {
          target: "idle",
          action: (ctx, finalCount?: number) => {
            expectType<number>(ctx.count);
            ctx.active = false;
            if (finalCount !== undefined) {
              ctx.count = finalCount;
            }
          },
        },
      },
    },
  },
});

// Test 2: Complex nested context
const complexMachine = createMachine({
  initial: "loading" as const,
  context: {
    user: {
      id: "",
      profile: {
        name: "",
        age: 0,
      },
    },
    settings: {
      theme: "dark" as "dark" | "light",
      notifications: true,
    },
    counters: [0, 0, 0],
  },
  states: {
    loading: {
      on: {
        LOADED: {
          target: "ready",
          action: (
            ctx,
            userData: { id: string; name: string; age: number },
          ) => {
            expectType<string>(ctx.user.id);
            expectType<string>(ctx.user.profile.name);
            expectType<number>(ctx.user.profile.age);
            expectType<"dark" | "light">(ctx.settings.theme);
            expectType<boolean>(ctx.settings.notifications);
            expectType<number[]>(ctx.counters);

            ctx.user.id = userData.id;
            ctx.user.profile.name = userData.name;
            ctx.user.profile.age = userData.age;
          },
        },
      },
    },
    ready: {
      on: {
        UPDATE_THEME: {
          target: "ready",
          action: (ctx, theme: "dark" | "light") => {
            expectType<"dark" | "light">(ctx.settings.theme);
            ctx.settings.theme = theme;
          },
        },
        INCREMENT_COUNTER: {
          target: "ready",
          action: (ctx, index: number) => {
            expectType<number[]>(ctx.counters);
            if (index >= 0 && index < ctx.counters.length) {
              ctx.counters[index]++;
            }
          },
        },
      },
    },
  },
});

// Test 3: Type inference for Punchcard class
type BasicMachineType = typeof basicMachine;
declare const punchcard: Punchcard<BasicMachineType>;

// Test context type
expectType<{
  count: number;
  name: string;
  active: boolean;
}>(punchcard.context);

// Test available actions
expectType<("START" | "INCREMENT" | "STOP")[]>(punchcard.getAvailableActions());

// Test 4: Action signatures inference
type BasicActions = ReturnType<typeof inferActions<typeof basicMachine>>;

// This should infer the correct parameter types for each action
const basicActions = inferActions(basicMachine);

// TODO: fix
// expectType<{
//   START: number;
//   INCREMENT: undefined;
//   STOP: number | undefined;
// }>(basicActions);

type ComplexActions = ReturnType<typeof inferActions<typeof complexMachine>>;

const complexActions = inferActions(complexMachine);

// TODO: fix
// expectType<{
//   LOADED: { id: string; name: string; age: number };
//   UPDATE_THEME: "dark" | "light";
//   INCREMENT_COUNTER: number;
// }>(complexActions);

// Test 5: Runtime usage should have proper types
async function testUsage() {
  const machine = createMachine({
    initial: "waiting" as const,
    context: {
      value: 42,
      message: "hello",
    },
    states: {
      waiting: {
        on: {
          SET_VALUE: {
            target: "waiting",
            action: (ctx, newValue: number) => {
              // ctx should be typed as { value: number; message: string }
              expectType<number>(ctx.value);
              expectType<string>(ctx.message);
              ctx.value = newValue;
            },
          },
          SET_MESSAGE: {
            target: "waiting",
            action: (ctx, msg: string) => {
              expectType<string>(ctx.message);
              ctx.message = msg;
            },
          },
        },
      },
    },
  });

  // Mock hypercore for testing
  const mockCore = {} as any;
  const state = new Punchcard(mockCore, machine);

  // These should be properly typed
  expectType<number>(state.context.value);
  expectType<string>(state.context.message);

  // Action calls should be type-checked
  await state.action("SET_VALUE", 123); // ✓ correct
  await state.action("SET_MESSAGE", "hi"); // ✓ correct

  // These should cause type errors:
  // await state.action('INVALID_ACTION', 123); // ❌ invalid action
  // await state.action('SET_VALUE', 'string'); // ❌ wrong parameter type
  // await state.action('SET_VALUE'); // ❌ missing required parameter
}

// Test 6: Utility function for getting action types
function getActionTypes<T extends MachineConfig<any, any>>(machine: T) {
  return inferActions(machine);
}

const actionTypes = getActionTypes(basicMachine);
// Note: Due to TypeScript limitations, this may not infer exactly as expected
// but the runtime behavior should still be correct

// Export for additional testing
export { basicMachine, complexMachine, testUsage };
