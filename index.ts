import ReadyResource from "ready-resource";
import Hypercore from "hypercore";

// Simple type aliases for better readability
type MachineDefinition = {
  initial: string;
  context: any;
  states: Record<string, StateDefinition>;
};

type StateDefinition = {
  on: Record<string, TransitionDefinition>;
};

type TransitionDefinition = {
  target: string;
  action: (ctx: any, ...args: any[]) => void | Promise<void>;
};

interface ReadStreamOptions {
  start?: number;
  end?: number;
  live?: boolean;
  snapshot?: boolean;
}

// Extract event names from machine definition
type EventNames<T> = T extends { states: Record<string, { on: infer Events }> }
  ? Events extends Record<string, any>
    ? keyof Events
    : never
  : never;

// Get parameter type from action function signature
type ActionParam<T> = T extends {
  states: Record<string, { on: Record<string, { action: infer A }> }>;
}
  ? A extends (ctx: any, param: infer P) => any
    ? P
    : A extends (ctx: any) => any
      ? never
      : never
  : never;

export const createMachine = <const T extends MachineDefinition>(
  definition: T,
) => {
  return definition;
};

export class Hyperstate<T extends MachineDefinition> extends ReadyResource {
  #core: Hypercore;
  #machine: T;
  #state: string;
  #context: any;

  constructor(core: Hypercore, machine: T) {
    super();
    this.#core = core;
    this.#machine = machine;
    this.#state = machine.initial;
    this.#context = machine.context;
  }

  override async _open() {
    await this.#core.ready();

    if (this.#core.length > 0) {
      // Get last state from core
      const lastState: { state: string; context: any } = await this.#core.get(
        this.#core.length - 1,
      );
      this.#state = lastState.state;
      this.#context = lastState.context;
    }
  }
  override async _close() {
    await this.#core.close();
  }

  // Clean method signature with constrained event names
  async action<E extends EventNames<T>>(
    event: E,
    value?: ActionParam<T>,
  ): Promise<void> {
    const currentState = this.#machine.states[this.#state];
    const transition = currentState?.on[event as string];

    if (transition) {
      await transition.action(this.#context, value);
      await this.#core.append({
        state: transition.target,
        context: this.#context,
      });

      this.emit("stateChange", {
        newState: transition.target,
        oldState: this.#state,
      });

      this.#state = transition.target;
    } else {
      // throw invalid action
      throw new Error(`Invalid action: ${event} for state ${this.#state}`);
    }
  }

  truncate(newLength: number) {
    return this.#core.truncate(newLength);
  }

  get state() {
    return this.#state;
  }

  get context() {
    return this.#context;
  }

  get isEmpty() {
    return this.#core.length === 0;
  }

  get key() {
    return this.#core.key;
  }

  get discoveryKey() {
    return this.#core.discoveryKey;
  }

  createReadStream(options?: ReadStreamOptions) {
    return this.#core.createReadStream({ ...options, valueEncoding: "json" });
  }
}
