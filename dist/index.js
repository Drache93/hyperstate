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
    constructor(core, machine) {
        super();
        this._core = core;
        this._machine = machine;
        this._state = machine.initial;
        this._context = machine.context;
    }
    async _open() {
        await this._core.ready();
        if (this._core.length > 0) {
            const lastState = await this._core.get(this._core.length - 1);
            this._state = lastState.state;
            this._context = lastState.context;
        }
    }
    async _close() {
        await this._core.close();
    }
    async action(event, value) {
        const currentState = this._machine.states[this._state];
        const transition = currentState?.on[event];
        if (transition) {
            await transition.action(this._context, value);
            await this._core.append({
                state: transition.target,
                context: this._context,
            });
            this._state = transition.target;
        }
        else {
            throw new Error(`Invalid action: ${String(event)} for state ${this._state}`);
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
