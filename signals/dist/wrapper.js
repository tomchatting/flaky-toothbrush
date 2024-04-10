/**
 * @license
 * Copyright 2024 Bloomberg Finance L.P.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { computedGet, createComputed, } from "./computed.js";
import { SIGNAL, getActiveConsumer, isInNotificationPhase, producerAccessed, assertConsumerNode, setActiveConsumer, REACTIVE_NODE, assertProducerNode, producerRemoveLiveConsumerAtIndex, } from "./graph.js";
import { createSignal, signalGetFn, signalSetFn, } from "./signal.js";
const NODE = Symbol("node");
let isState, isComputed, isWatcher;
// eslint-disable-next-line @typescript-eslint/no-namespace
export var Signal;
(function (Signal) {
    // A read-write Signal
    class State {
        [NODE];
        #brand() { }
        static {
            isState = s => #brand in s;
        }
        constructor(initialValue, options = {}) {
            const ref = createSignal(initialValue);
            const node = ref[SIGNAL];
            this[NODE] = node;
            node.wrapper = this;
            if (options) {
                const equals = options.equals;
                if (equals) {
                    node.equal = equals;
                }
                node.watched = options[Signal.subtle.watched];
                node.unwatched = options[Signal.subtle.unwatched];
            }
        }
        get() {
            if (!isState(this))
                throw new TypeError("Wrong receiver type for Signal.State.prototype.get");
            return (signalGetFn).call(this[NODE]);
        }
        set(newValue) {
            if (!isState(this))
                throw new TypeError("Wrong receiver type for Signal.State.prototype.set");
            if (isInNotificationPhase()) {
                throw new Error("Writes to signals not permitted during Watcher callback");
            }
            const ref = this[NODE];
            signalSetFn(ref, newValue);
        }
    }
    Signal.State = State;
    // A Signal which is a formula based on other Signals
    class Computed {
        [NODE];
        #brand() { }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        static {
            isComputed = (c) => #brand in c;
        }
        // Create a Signal which evaluates to the value returned by the callback.
        // Callback is called with this signal as the parameter.
        constructor(computation, options) {
            const ref = createComputed(computation);
            const node = ref[SIGNAL];
            node.consumerAllowSignalWrites = true;
            this[NODE] = node;
            node.wrapper = this;
            if (options) {
                const equals = options.equals;
                if (equals) {
                    node.equal = equals;
                }
                node.watched = options[Signal.subtle.watched];
                node.unwatched = options[Signal.subtle.unwatched];
            }
        }
        get() {
            if (!isComputed(this))
                throw new TypeError("Wrong receiver type for Signal.Computed.prototype.get");
            return computedGet(this[NODE]);
        }
    }
    Signal.Computed = Computed;
    // eslint-disable-next-line @typescript-eslint/no-namespace
    let subtle;
    (function (subtle) {
        // Run a callback with all tracking disabled (even for nested computed).
        function untrack(cb) {
            let output;
            let prevActiveConsumer = null;
            try {
                prevActiveConsumer = setActiveConsumer(null);
                output = cb();
            }
            finally {
                setActiveConsumer(prevActiveConsumer);
            }
            return output;
        }
        subtle.untrack = untrack;
        // Returns ordered list of all signals which this one referenced
        // during the last time it was evaluated
        function introspectSources(sink) {
            if (!isComputed(sink) && !isWatcher(sink)) {
                throw new TypeError("Called introspectSources without a Computed or Watcher argument");
            }
            return sink[NODE].producerNode?.map((n) => n.wrapper) ?? [];
        }
        subtle.introspectSources = introspectSources;
        // Returns the subset of signal sinks which recursively
        // lead to an Effect which has not been disposed
        // Note: Only watched Computed signals will be in this list.
        function introspectSinks(signal) {
            if (!isComputed(signal) && !isState(signal)) {
                throw new TypeError("Called introspectSinks without a Signal argument");
            }
            return signal[NODE].liveConsumerNode?.map((n) => n.wrapper) ?? [];
        }
        subtle.introspectSinks = introspectSinks;
        // True iff introspectSinks() is non-empty
        function hasSinks(signal) {
            if (!isComputed(signal) && !isState(signal)) {
                throw new TypeError("Called hasSinks without a Signal argument");
            }
            const liveConsumerNode = signal[NODE].liveConsumerNode;
            if (!liveConsumerNode)
                return false;
            return liveConsumerNode.length > 0;
        }
        subtle.hasSinks = hasSinks;
        // True iff introspectSources() is non-empty
        function hasSources(signal) {
            if (!isComputed(signal) && !isWatcher(signal)) {
                throw new TypeError("Called hasSources without a Computed or Watcher argument");
            }
            const producerNode = signal[NODE].producerNode;
            if (!producerNode)
                return false;
            return producerNode.length > 0;
        }
        subtle.hasSources = hasSources;
        class Watcher {
            [NODE];
            #brand() { }
            static {
                isWatcher = (w) => #brand in w;
            }
            // When a (recursive) source of Watcher is written to, call this callback,
            // if it hasn't already been called since the last `watch` call.
            // No signals may be read or written during the notify.
            constructor(notify) {
                let node = Object.create(REACTIVE_NODE);
                node.wrapper = this;
                node.consumerMarkedDirty = notify;
                node.consumerIsAlwaysLive = true;
                node.consumerAllowSignalWrites = false;
                node.producerNode = [];
                this[NODE] = node;
            }
            #assertSignals(signals) {
                for (const signal of signals) {
                    if (!isComputed(signal) && !isState(signal)) {
                        throw new TypeError("Called watch/unwatch without a Computed or State argument");
                    }
                }
            }
            // Add these signals to the Watcher's set, and set the watcher to run its
            // notify callback next time any signal in the set (or one of its dependencies) changes.
            // Can be called with no arguments just to reset the "notified" state, so that
            // the notify callback will be invoked again.
            watch(...signals) {
                if (!isWatcher(this)) {
                    throw new TypeError("Called unwatch without Watcher receiver");
                }
                this.#assertSignals(signals);
                const node = this[NODE];
                node.dirty = false; // Give the watcher a chance to trigger again
                const prev = setActiveConsumer(node);
                for (const signal of signals) {
                    producerAccessed(signal[NODE]);
                }
                setActiveConsumer(prev);
            }
            // Remove these signals from the watched set (e.g., for an effect which is disposed)
            unwatch(...signals) {
                if (!isWatcher(this)) {
                    throw new TypeError("Called unwatch without Watcher receiver");
                }
                this.#assertSignals(signals);
                const node = this[NODE];
                assertConsumerNode(node);
                let indicesToShift = [];
                for (let i = 0; i < node.producerNode.length; i++) {
                    if (signals.includes(node.producerNode[i].wrapper)) {
                        producerRemoveLiveConsumerAtIndex(node.producerNode[i], node.producerIndexOfThis[i]);
                        indicesToShift.push(i);
                    }
                }
                for (const idx of indicesToShift) {
                    // Logic copied from producerRemoveLiveConsumerAtIndex, but reversed
                    const lastIdx = node.producerNode.length - 1;
                    node.producerNode[idx] = node.producerNode[lastIdx];
                    node.producerIndexOfThis[idx] = node.producerIndexOfThis[lastIdx];
                    node.producerNode.length--;
                    node.producerIndexOfThis.length--;
                    node.nextProducerIndex--;
                    if (idx < node.producerNode.length) {
                        const idxConsumer = node.producerIndexOfThis[idx];
                        const producer = node.producerNode[idx];
                        assertProducerNode(producer);
                        producer.liveConsumerIndexOfThis[idxConsumer] = idx;
                    }
                }
            }
            // Returns the set of computeds in the Watcher's set which are still yet
            // to be re-evaluated
            getPending() {
                if (!isWatcher(this)) {
                    throw new TypeError("Called getPending without Watcher receiver");
                }
                const node = this[NODE];
                return node.producerNode.filter((n) => n.dirty).map((n) => n.wrapper);
            }
        }
        subtle.Watcher = Watcher;
        function currentComputed() {
            return getActiveConsumer()?.wrapper;
        }
        subtle.currentComputed = currentComputed;
        // Hooks to observe being watched or no longer watched
        subtle.watched = Symbol("watched");
        subtle.unwatched = Symbol("unwatched");
    })(subtle = Signal.subtle || (Signal.subtle = {}));
})(Signal || (Signal = {}));
//# sourceMappingURL=wrapper.js.map