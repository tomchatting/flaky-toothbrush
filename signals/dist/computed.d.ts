/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { ValueEqualityFn } from './equality.js';
import { ReactiveNode, SIGNAL } from './graph.js';
/**
 * A computation, which derives a value from a declarative reactive expression.
 *
 * `Computed`s are both producers and consumers of reactivity.
 */
export interface ComputedNode<T> extends ReactiveNode {
    /**
     * Current value of the computation, or one of the sentinel values above (`UNSET`, `COMPUTING`,
     * `ERROR`).
     */
    value: T;
    /**
     * If `value` is `ERRORED`, the error caught from the last computation attempt which will
     * be re-thrown.
     */
    error: unknown;
    /**
     * The computation function which will produce a new value.
     */
    computation: () => T;
    equal: ValueEqualityFn<T>;
}
export type ComputedGetter<T> = (() => T) & {
    [SIGNAL]: ComputedNode<T>;
};
export declare function computedGet<T>(node: ComputedNode<T>): T;
/**
 * Create a computed signal which derives a reactive value from an expression.
 */
export declare function createComputed<T>(computation: () => T): ComputedGetter<T>;
//# sourceMappingURL=computed.d.ts.map