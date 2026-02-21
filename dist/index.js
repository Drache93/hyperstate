import { Duplex } from "streamx";
// Improved createMachine function with better type inference
export function createMachine(config) {
    return config;
}
// Utility function to infer action types and payloads
export function inferActions(machine) {
    const result = {};
    // Collect all action names from all states
    for (const stateName in machine.states) {
        const state = machine.states[stateName];
        for (const action in state.on) {
            result[action] = undefined; // Placeholder for type inference
        }
    }
    return result;
}
export class Hypercube extends Duplex {
    constructor(core, machine, opts = {}) {
        super();
        this._currentIndex = null;
        this._eager = false;
        this._core = core;
        this._machine = machine;
        this._state = machine.initial;
        this._context = structuredClone(machine.context);
        this._eager = Boolean(opts.eager);
    }
    _open(cb) {
        this._core
            .ready()
            .then(async () => {
            if (this._core.length > 0) {
                const lastState = await this._core.get(this._core.length - 1);
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
    _write(chunk, cb) {
        this.action(chunk.action, chunk.value).then(() => cb(), cb);
    }
    _read(cb) {
        cb();
    }
    _destroy(cb) {
        this._core.close().then(() => cb(), cb);
    }
    async action(action, value) {
        const currentState = this._machine.states[this._state];
        const transition = currentState?.on[action] ||
            this._machine.states.all?.[action];
        if (!transition) {
            throw new Error(`Invalid action: ${String(action)} for state ${this._state}`);
        }
        const oldState = structuredClone(this._context);
        await transition.action(this._context, value);
        await this._core.append({
            state: transition.target || this._state,
            context: this._context,
        });
        this._state = transition.target || this._state;
        if (transition.target) {
            // @ts-ignore
            this.push({ state: this._state, context: this._context });
        }
        return { state: this._state, context: this._context };
    }
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
    getAvailableActions() {
        const currentState = this._machine.states[this._state];
        return Object.keys(currentState?.on || {});
    }
}
