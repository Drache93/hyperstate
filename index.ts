import ReadyResource from "ready-resource";
import Hypercore from "hypercore";

// More sophisticated type definitions for better inference
type MachineDefinition = {
  initial: string;
  context: Record<string, any>;
  states: Record<string, StateDefinition>;
};

type StateDefinition = {
  on: Record<string, TransitionDefinition>;
};

type TransitionDefinition = {
  target: string;
  action: (ctx: any, ...args: any[]) => void | Promise<void>;
};

// Extract context type from the actual machine definition
type InferContext<T> = T extends { context: infer C } ? C : never;

// Extract event names
type EventNames<T> = T extends {
  states: Record<string, { on: Record<infer E, any> }>;
}
  ? E
  : never;

// Create a machine with proper type inference
export const createMachine = <
  const TContext extends Record<string, any>,
  const T extends {
    initial: string;
    context: TContext;
    states: Record<
      string,
      {
        on: Record<
          string,
          {
            target: string;
            action: (ctx: TContext, ...args: any[]) => void | Promise<void>;
          }
        >;
      }
    >;
  },
>(
  definition: T,
): T & { __context: TContext } => {
  return definition as T & { __context: TContext };
};

// Type-safe machine type that preserves context type
type TypedMachine<TContext extends Record<string, any>> = {
  initial: string;
  context: TContext;
  states: Record<
    string,
    {
      on: Record<
        string,
        {
          target: string;
          action: (ctx: TContext, ...args: any[]) => void | Promise<void>;
        }
      >;
    }
  >;
  __context: TContext;
};

export class Hyperstate<T extends TypedMachine<any>> extends ReadyResource {
  #core: Hypercore;
  #machine: T;
  #state: string;
  #context: T["__context"];

  constructor(core: Hypercore, machine: T) {
    super();
    this.#core = core;
    this.#machine = machine;
    this.#state = machine.initial;
    this.#context = machine.context;
  }

  // Rest of implementation stays the same but with proper typing
  override async _open() {
    await this.#core.ready();

    if (this.#core.length > 0) {
      const lastState: { state: string; context: T["__context"] } =
        await this.#core.get(this.#core.length - 1);
      this.#state = lastState.state;
      this.#context = lastState.context;
    }
  }

  override async _close() {
    await this.#core.close();
  }

  async action<E extends EventNames<T>>(
    event: E,
    value?: any, // You can make this more specific based on your needs
  ): Promise<void> {
    const currentState = this.#machine.states[this.#state];
    const transition = currentState?.on[event as string];

    if (transition) {
      // Now ctx is properly typed as T['__context']!
      await transition.action(this.#context, value);
      await this.#core.append({
        state: transition.target,
        context: this.#context,
      });
      this.#state = transition.target;
    } else {
      throw new Error(`Invalid action: ${event} for state ${this.#state}`);
    }
  }

  get context(): T["__context"] {
    return this.#context;
  }

  get state() {
    return this.#state;
  }

  truncate(newLength: number) {
    return this.#core.truncate(newLength);
  }

  get isEmpty() {
    return this.#core.length === 0;
  }
}
