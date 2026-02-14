import ReadyResource from "ready-resource";
import Hypercore from "hypercore";

// Core type definitions with proper generic constraints
export type MachineConfig<
  TContext extends Record<string, any> = Record<string, any>,
  TStates extends Record<string, StateConfig<TContext>> = Record<
    string,
    StateConfig<TContext>
  >,
> = {
  initial: keyof TStates;
  context: TContext;
  states: TStates;
};

export type StateConfig<TContext extends Record<string, any>> = {
  on: Record<string, TransitionConfig<TContext>>;
};

export type TransitionConfig<TContext extends Record<string, any>> = {
  target: string;
  action: (ctx: TContext, ...args: any[]) => void | Promise<void>;
};

// Type utilities for extracting information from machine definitions
export type ExtractContext<T> =
  T extends MachineConfig<infer C, any> ? C : never;

export type ExtractStates<T> =
  T extends MachineConfig<any, infer S> ? keyof S : never;

type ExtractEvents<T> =
  T extends MachineConfig<any, infer S>
    ? S extends Record<string, { on: Record<infer E, any> }>
      ? E
      : never
    : never;

// Extract action parameter types for specific events
type ExtractActionParams<T, E extends string> =
  T extends MachineConfig<any, infer S>
    ? {
        [K in keyof S]: S[K] extends {
          on: Record<E, { action: (ctx: any, ...args: infer P) => any }>;
        }
          ? P extends [infer First, ...any[]]
            ? First
            : undefined
          : never;
      }[keyof S]
    : never;

// Extract all action signatures from a machine
type ExtractActionSignatures<T> =
  T extends MachineConfig<any, infer S>
    ? {
        [K in ExtractEvents<T>]: ExtractActionParams<
          T,
          K extends string ? K : never
        > extends never
          ? undefined
          : ExtractActionParams<T, K extends string ? K : never>;
      }
    : never;

// Improved createMachine function with better type inference
export function createMachine<
  TContext extends Record<string, any>,
  TStates extends Record<string, StateConfig<TContext>>,
>(
  config: MachineConfig<TContext, TStates> & {
    initial: keyof TStates;
    context: TContext;
    states: TStates;
  },
): MachineConfig<TContext, TStates> {
  return config;
}

// Utility function to infer action types and payloads
export function inferActions<T extends MachineConfig<any, any>>(
  machine: T,
): ExtractActionSignatures<T> {
  const result = {} as any;

  // Collect all event names from all states
  for (const stateName in machine.states) {
    const state = machine.states[stateName];
    for (const eventName in state.on) {
      result[eventName] = undefined; // Placeholder for type inference
    }
  }

  return result as ExtractActionSignatures<T>;
}

export type Infer<T extends MachineConfig<any, any>> = ReturnType<
  typeof inferActions<T>
>;

interface HyperstateOptions {
  eager?: boolean;
}

export class Hyperstate<
  T extends MachineConfig<any, any>,
> extends ReadyResource {
  private _core: Hypercore;
  private _machine: T;
  private _state: ExtractStates<T>;
  private _context: ExtractContext<T>;
  private _currentIndex: number | null = null;
  private _eager = false;

  constructor(core: Hypercore, machine: T, opts: HyperstateOptions = {}) {
    super();
    this._core = core;
    this._machine = machine;
    this._state = machine.initial as any;
    this._context = machine.context;
    this._eager = Boolean(opts.eager);
  }

  async _open() {
    await this._core.ready();

    if (this._core.length > 0) {
      const lastState: { state: ExtractStates<T>; context: ExtractContext<T> } =
        await this._core.get(this._core.length - 1);
      this._state = lastState.state;
      this._context = lastState.context;

      const currentState = this._machine.states[this._state];
      if (currentState?.on.start?.target) {
        this._state = currentState.on.start.target;
      }

      if (this._eager) {
        this.emit("stateChange", { newState: this._context });
      }
    }
  }

  async _close() {
    await this._core.close();
  }

  async action<E extends ExtractEvents<T>>(
    event: E,
    value?: ExtractActionParams<T, E extends string ? E : never>,
  ): Promise<{
    state: ExtractStates<T>;
    context: ExtractContext<T>;
  }> {
    const currentState = this._machine.states[this._state];
    const transition = currentState?.on[event as string];

    if (transition) {
      const oldState = structuredClone(this._context);
      await transition.action(this._context, value);
      await this._core.append({
        state: transition.target,
        context: this._context,
      });
      this._state = transition.target as ExtractStates<T>;
      this.emit("stateChange", { newState: this._context, oldState });

      return {
        state: this._state,
        context: this._context,
      };
    } else {
      throw new Error(
        `Invalid action: ${String(event)} for state ${this._state as string}`,
      );
    }
  }

  /*
   * Move forward in the history
   *
   * Will replace the current state with the next state in the history.
   */
  async forward() {
    const newIndex =
      this._currentIndex === null
        ? this._core.length - 2
        : this._currentIndex + 1;

    if (this._core.length > newIndex && newIndex < this._core.length) {
      const nextState = await this._core.get(newIndex);
      this._state = nextState.state;
      this._context = nextState.context;
      this._currentIndex = newIndex;
    }
  }

  /*
   * Move backward in the history.
   *
   * Will replace the current state with the previous state in the history.
   */
  async backward() {
    const newIndex =
      this._currentIndex === null
        ? this._core.length - 2
        : this._currentIndex - 1;

    if (this._core.length > newIndex && newIndex >= 0) {
      const lastState = await this._core.get(newIndex);
      this._state = lastState.state;
      this._context = lastState.context;
      this._currentIndex = newIndex;
    }
  }

  truncate(newLength: number) {
    return this._core.truncate(newLength);
  }

  get state(): ExtractStates<T> {
    return this._state;
  }

  get context(): ExtractContext<T> {
    return this._context;
  }

  get isEmpty() {
    return this._core.length === 0;
  }

  // Helper method to get available actions for current state
  getAvailableActions(): Array<ExtractEvents<T>> {
    const currentState = this._machine.states[this._state];
    return Object.keys(currentState?.on || {}) as Array<ExtractEvents<T>>;
  }
}
