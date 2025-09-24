import ReadyResource from "ready-resource";
import Hypercore from "hypercore";
export type MachineConfig<TContext extends Record<string, any> = Record<string, any>, TStates extends Record<string, StateConfig<TContext>> = Record<string, StateConfig<TContext>>> = {
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
type ExtractContext<T> = T extends MachineConfig<infer C, any> ? C : never;
type ExtractEvents<T> = T extends MachineConfig<any, infer S> ? S extends Record<string, {
    on: Record<infer E, any>;
}> ? E : never : never;
type ExtractActionParams<T, E extends string> = T extends MachineConfig<any, infer S> ? {
    [K in keyof S]: S[K] extends {
        on: Record<E, {
            action: (ctx: any, ...args: infer P) => any;
        }>;
    } ? P extends [infer First, ...any[]] ? First : undefined : never;
}[keyof S] : never;
type ExtractActionSignatures<T> = T extends MachineConfig<any, infer S> ? {
    [K in ExtractEvents<T>]: ExtractActionParams<T, K extends string ? K : never> extends never ? undefined : ExtractActionParams<T, K extends string ? K : never>;
} : never;
export declare function createMachine<TContext extends Record<string, any>, TStates extends Record<string, StateConfig<TContext>>>(config: MachineConfig<TContext, TStates> & {
    initial: keyof TStates;
    context: TContext;
    states: TStates;
}): MachineConfig<TContext, TStates>;
export declare function inferActions<T extends MachineConfig<any, any>>(machine: T): ExtractActionSignatures<T>;
export type Infer<T extends MachineConfig<any, any>> = ReturnType<typeof inferActions<T>>;
export declare class Hyperstate<T extends MachineConfig<any, any>> extends ReadyResource {
    private _core;
    private _machine;
    private _state;
    private _context;
    constructor(core: Hypercore, machine: T);
    _open(): Promise<void>;
    _close(): Promise<void>;
    action<E extends ExtractEvents<T>>(event: E, value?: ExtractActionParams<T, E extends string ? E : never>): Promise<void>;
    truncate(newLength: number): any;
    get state(): string;
    get context(): ExtractContext<T>;
    get isEmpty(): boolean;
    getAvailableActions(): Array<ExtractEvents<T>>;
}
export {};
