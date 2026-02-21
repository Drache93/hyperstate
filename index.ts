import Hypercore from "hypercore";
import { Duplex } from "streamx";

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

type ExtractActions<T> =
  T extends MachineConfig<any, infer S>
    ? S extends Record<string, { on: Record<infer E, any> }>
      ? E
      : never
    : never;

// Extract action parameter types for specific actions
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
        [K in ExtractActions<T>]: ExtractActionParams<
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

  // Collect all action names from all states
  for (const stateName in machine.states) {
    const state = machine.states[stateName];
    for (const action in state.on) {
      result[action] = undefined; // Placeholder for type inference
    }
  }

  return result as ExtractActionSignatures<T>;
}

export type Infer<T extends MachineConfig<any, any>> = ReturnType<
  typeof inferActions<T>
>;

export type ActionMessage<T extends MachineConfig<any, any>> = {
  [E in ExtractActions<T> & string]: ExtractActionParams<T, E> extends never
    ? { action: E; value?: undefined }
    : undefined extends ExtractActionParams<T, E>
      ? { action: E; value?: ExtractActionParams<T, E> }
      : { action: E; value: ExtractActionParams<T, E> };
}[ExtractActions<T> & string];

export type StateMessage<T extends MachineConfig<any, any>> = {
  state: ExtractStates<T>;
  context: ExtractContext<T>;
};

interface CoremachineOptions {
  eager?: boolean;
}

export class Coremachine<T extends MachineConfig<any, any>> extends Duplex<
  ActionMessage<T>,
  StateMessage<T>
> {
  private _core: Hypercore;
  private _machine: T;
  private _state: ExtractStates<T>;
  private _context: ExtractContext<T>;
  private _currentIndex: number | null = null;
  private _eager = false;

  constructor(core: Hypercore, machine: T, opts: CoremachineOptions = {}) {
    super();
    this._core = core;
    this._machine = machine;
    this._state = machine.initial as any;
    this._context = structuredClone(machine.context);
    this._eager = Boolean(opts.eager);
  }

  _open(cb: (err?: Error | null) => void) {
    this._core
      .ready()
      .then(async () => {
        if (this._core.length > 0) {
          const lastState: {
            state: ExtractStates<T>;
            context: ExtractContext<T>;
          } = await this._core.get(this._core.length - 1);
          this._state = lastState.state;
          this._context = lastState.context;

          const currentState = this._machine.states[this._state];
          if (currentState?.on.start?.target) {
            this._state = currentState.on.start.target;
          }
          if (currentState?.on.start?.action) {
            await currentState.on.start.action(this._context, this._state);
          }

          if (this._eager) {
            // @ts-ignore
            this.push({ state: this._state, context: this._context });
          }
        }
        cb();
      })
      .catch(cb);
  }

  _write(chunk: ActionMessage<T>, cb: (err?: Error | null) => void) {
    this.action(chunk.action, chunk.value).then(() => cb(), cb);
  }

  _read(cb: (err?: Error | null) => void) {
    cb();
  }

  _destroy(cb: (err?: Error | null) => void) {
    this._core.close().then(() => cb(), cb);
  }

  async action<E extends ExtractActions<T>>(
    action: E,
    value?: ExtractActionParams<T, E extends string ? E : never>,
  ): Promise<{
    state: ExtractStates<T>;
    context: ExtractContext<T>;
  }> {
    const currentState = this._machine.states[this._state];
    const transition =
      currentState?.on[action as string] ||
      this._machine.states.all?.[action as string];

    if (!transition) {
      throw new Error(
        `Invalid action: ${String(action)} for state ${this._state as string}`,
      );
    }

    const oldState = structuredClone(this._context);
    await transition.action(this._context, value);
    await this._core.append({
      state: transition.target || this._state,
      context: this._context,
    });
    this._state = (transition.target as ExtractStates<T>) || this._state;

    if (transition.target) {
      // @ts-ignore
      this.push({ state: this._state, context: this._context });
    }

    return { state: this._state, context: this._context };
  }

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

  getAvailableActions(): Array<ExtractActions<T>> {
    const currentState = this._machine.states[this._state];
    return Object.keys(currentState?.on || {}) as Array<ExtractActions<T>>;
  }
}
