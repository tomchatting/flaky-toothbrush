/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ValueEqualityFn } from './equality.js';
import { ReactiveNode, SIGNAL } from './graph.js';
export interface SignalNode<T> extends ReactiveNode {
    value: T;
    equal: ValueEqualityFn<T>;
}
export type SignalBaseGetter<T> = (() => T) & {
    readonly [SIGNAL]: unknown;
};
export interface SignalGetter<T> extends SignalBaseGetter<T> {
    readonly [SIGNAL]: SignalNode<T>;
}
/**
 * Create a `Signal` that can be set or updated directly.
 */
export declare function createSignal<T>(initialValue: T): SignalGetter<T>;
export declare function setPostSignalSetFn(fn: (() => void) | null): (() => void) | null;
export declare function signalGetFn<T>(this: SignalNode<T>): T;
export declare function signalSetFn<T>(node: SignalNode<T>, newValue: T): void;
export declare function signalUpdateFn<T>(node: SignalNode<T>, updater: (value: T) => T): void;
export declare const SIGNAL_NODE: SignalNode<unknown>;
//# sourceMappingURL=signal.d.ts.map