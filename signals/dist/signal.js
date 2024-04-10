/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { defaultEquals } from './equality.js';
import { throwInvalidWriteToSignalError } from './errors.js';
import { producerAccessed, producerIncrementEpoch, producerNotifyConsumers, producerUpdatesAllowed, REACTIVE_NODE, SIGNAL } from './graph.js';
/**
 * If set, called after `WritableSignal`s are updated.
 *
 * This hook can be used to achieve various effects, such as running effects synchronously as part
 * of setting a signal.
 */
let postSignalSetFn = null;
/**
 * Create a `Signal` that can be set or updated directly.
 */
export function createSignal(initialValue) {
    const node = Object.create(SIGNAL_NODE);
    node.value = initialValue;
    const getter = (() => {
        producerAccessed(node);
        return node.value;
    });
    getter[SIGNAL] = node;
    return getter;
}
export function setPostSignalSetFn(fn) {
    const prev = postSignalSetFn;
    postSignalSetFn = fn;
    return prev;
}
export function signalGetFn() {
    producerAccessed(this);
    return this.value;
}
export function signalSetFn(node, newValue) {
    if (!producerUpdatesAllowed()) {
        throwInvalidWriteToSignalError();
    }
    if (!node.equal.call(node.wrapper, node.value, newValue)) {
        node.value = newValue;
        signalValueChanged(node);
    }
}
export function signalUpdateFn(node, updater) {
    if (!producerUpdatesAllowed()) {
        throwInvalidWriteToSignalError();
    }
    signalSetFn(node, updater(node.value));
}
// Note: Using an IIFE here to ensure that the spread assignment is not considered
// a side-effect, ending up preserving `COMPUTED_NODE` and `REACTIVE_NODE`.
// TODO: remove when https://github.com/evanw/esbuild/issues/3392 is resolved.
export const SIGNAL_NODE = /* @__PURE__ */ (() => {
    return {
        ...REACTIVE_NODE,
        equal: defaultEquals,
        value: undefined,
    };
})();
function signalValueChanged(node) {
    node.version++;
    producerIncrementEpoch();
    producerNotifyConsumers(node);
    postSignalSetFn?.();
}
//# sourceMappingURL=signal.js.map