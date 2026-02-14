import ReadyResource from "ready-resource";
// Improved createMachine function with better type inference
export function createMachine(config) {
    return config;
}
// Utility function to infer action types and payloads
export function inferActions(machine) {
    const result = {};
    // Collect all event names from all states
    for (const stateName in machine.states) {
        const state = machine.states[stateName];
        for (const eventName in state.on) {
            result[eventName] = undefined; // Placeholder for type inference
        }
    }
    return result;
}
export class Hyperstate extends ReadyResource {
    constructor(core, machine, opts = {}) {
        super();
        this._currentIndex = null;
        this._eager = false;
        this._core = core;
        this._machine = machine;
        this._state = machine.initial;
        this._context = machine.context;
        this._eager = Boolean(opts.eager);
    }
    async _open() {
        await this._core.ready();
        if (this._core.length > 0) {
            const lastState = await this._core.get(this._core.length - 1);
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
    async action(event, value) {
        const currentState = this._machine.states[this._state];
        const transition = currentState?.on[event];
        if (transition) {
            const oldState = structuredClone(this._context);
            await transition.action(this._context, value);
            await this._core.append({
                state: transition.target,
                context: this._context,
            });
            this._state = transition.target;
            this.emit("stateChange", { newState: this._context, oldState });
            return {
                state: this._state,
                context: this._context,
            };
        }
        else {
            throw new Error(`Invalid action: ${String(event)} for state ${this._state}`);
        }
    }
    /*
     * Move forward in the history
     *
     * Will replace the current state with the next state in the history.
     */
    async forward() {
        const newIndex = this._currentIndex === null
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
        const newIndex = this._currentIndex === null
            ? this._core.length - 2
            : this._currentIndex - 1;
        if (this._core.length > newIndex && newIndex >= 0) {
            const lastState = await this._core.get(newIndex);
            this._state = lastState.state;
            this._context = lastState.context;
            this._currentIndex = newIndex;
        }
    }
    truncate(newLength) {
        return this._core.truncate(newLength);
    }
    get state() {
        return this._state;
    }
    get context() {
        return this._context;
    }
    get isEmpty() {
        return this._core.length === 0;
    }
    // Helper method to get available actions for current state
    getAvailableActions() {
        const currentState = this._machine.states[this._state];
        return Object.keys(currentState?.on || {});
    }
}
