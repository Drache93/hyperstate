// index.ts
import ReadyResource from "ready-resource";
var createMachine = (definition) => {
  return definition;
};

class Hyperstate extends ReadyResource {
  #core;
  #machine;
  #state;
  #context;
  constructor(core, machine) {
    super();
    this.#core = core;
    this.#machine = machine;
    this.#state = machine.initial;
    this.#context = machine.context;
  }
  async _open() {
    await this.#core.ready();
    if (this.#core.length > 0) {
      const lastState = await this.#core.get(this.#core.length - 1);
      this.#state = lastState.state;
      this.#context = lastState.context;
    }
  }
  async _close() {
    await this.#core.close();
  }
  async action(event, value) {
    const currentState = this.#machine.states[this.#state];
    const transition = currentState?.on[event];
    if (transition) {
      await transition.action(this.#context, value);
      await this.#core.append({
        state: transition.target,
        context: this.#context
      });
      this.emit("stateChange", {
        newState: transition.target,
        oldState: this.#state
      });
      this.#state = transition.target;
    } else {
      throw new Error(`Invalid action: ${event} for state ${this.#state}`);
    }
  }
  truncate(newLength) {
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
}
export {
  createMachine,
  Hyperstate
};
