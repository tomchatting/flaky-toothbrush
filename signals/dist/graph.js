/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * The currently active consumer `ReactiveNode`, if running code in a reactive context.
 *
 * Change this via `setActiveConsumer`.
 */
let activeConsumer = null;
let inNotificationPhase = false;
/**
 * Global epoch counter. Incremented whenever a source signal is set.
 */
let epoch = 1;
/**
 * Symbol used to tell `Signal`s apart from other functions.
 *
 * This can be used to auto-unwrap signals in various cases, or to auto-wrap non-signal values.
 */
export const SIGNAL = /* @__PURE__ */ Symbol('SIGNAL');
export function setActiveConsumer(consumer) {
    const prev = activeConsumer;
    activeConsumer = consumer;
    return prev;
}
export function getActiveConsumer() {
    return activeConsumer;
}
export function isInNotificationPhase() {
    return inNotificationPhase;
}
export function isReactive(value) {
    return value[SIGNAL] !== undefined;
}
export const REACTIVE_NODE = {
    version: 0,
    lastCleanEpoch: 0,
    dirty: false,
    producerNode: undefined,
    producerLastReadVersion: undefined,
    producerIndexOfThis: undefined,
    nextProducerIndex: 0,
    liveConsumerNode: undefined,
    liveConsumerIndexOfThis: undefined,
    consumerAllowSignalWrites: false,
    consumerIsAlwaysLive: false,
    producerMustRecompute: () => false,
    producerRecomputeValue: () => { },
    consumerMarkedDirty: () => { },
    consumerOnSignalRead: () => { },
};
/**
 * Called by implementations when a producer's signal is read.
 */
export function producerAccessed(node) {
    if (inNotificationPhase) {
        throw new Error(typeof ngDevMode !== 'undefined' && ngDevMode ?
            `Assertion error: signal read during notification phase` :
            '');
    }
    if (activeConsumer === null) {
        // Accessed outside of a reactive context, so nothing to record.
        return;
    }
    activeConsumer.consumerOnSignalRead(node);
    // This producer is the `idx`th dependency of `activeConsumer`.
    const idx = activeConsumer.nextProducerIndex++;
    assertConsumerNode(activeConsumer);
    if (idx < activeConsumer.producerNode.length && activeConsumer.producerNode[idx] !== node) {
        // There's been a change in producers since the last execution of `activeConsumer`.
        // `activeConsumer.producerNode[idx]` holds a stale dependency which will be be removed and
        // replaced with `this`.
        //
        // If `activeConsumer` isn't live, then this is a no-op, since we can replace the producer in
        // `activeConsumer.producerNode` directly. However, if `activeConsumer` is live, then we need
        // to remove it from the stale producer's `liveConsumer`s.
        if (consumerIsLive(activeConsumer)) {
            const staleProducer = activeConsumer.producerNode[idx];
            producerRemoveLiveConsumerAtIndex(staleProducer, activeConsumer.producerIndexOfThis[idx]);
            // At this point, the only record of `staleProducer` is the reference at
            // `activeConsumer.producerNode[idx]` which will be overwritten below.
        }
    }
    if (activeConsumer.producerNode[idx] !== node) {
        // We're a new dependency of the consumer (at `idx`).
        activeConsumer.producerNode[idx] = node;
        // If the active consumer is live, then add it as a live consumer. If not, then use 0 as a
        // placeholder value.
        activeConsumer.producerIndexOfThis[idx] =
            consumerIsLive(activeConsumer) ? producerAddLiveConsumer(node, activeConsumer, idx) : 0;
    }
    activeConsumer.producerLastReadVersion[idx] = node.version;
}
/**
 * Increment the global epoch counter.
 *
 * Called by source producers (that is, not computeds) whenever their values change.
 */
export function producerIncrementEpoch() {
    epoch++;
}
/**
 * Ensure this producer's `version` is up-to-date.
 */
export function producerUpdateValueVersion(node) {
    if (consumerIsLive(node) && !node.dirty) {
        // A live consumer will be marked dirty by producers, so a clean state means that its version
        // is guaranteed to be up-to-date.
        return;
    }
    if (!node.dirty && node.lastCleanEpoch === epoch) {
        // Even non-live consumers can skip polling if they previously found themselves to be clean at
        // the current epoch, since their dependencies could not possibly have changed (such a change
        // would've increased the epoch).
        return;
    }
    if (!node.producerMustRecompute(node) && !consumerPollProducersForChange(node)) {
        // None of our producers report a change since the last time they were read, so no
        // recomputation of our value is necessary, and we can consider ourselves clean.
        node.dirty = false;
        node.lastCleanEpoch = epoch;
        return;
    }
    node.producerRecomputeValue(node);
    // After recomputing the value, we're no longer dirty.
    node.dirty = false;
    node.lastCleanEpoch = epoch;
}
/**
 * Propagate a dirty notification to live consumers of this producer.
 */
export function producerNotifyConsumers(node) {
    if (node.liveConsumerNode === undefined) {
        return;
    }
    // Prevent signal reads when we're updating the graph
    const prev = inNotificationPhase;
    inNotificationPhase = true;
    try {
        for (const consumer of node.liveConsumerNode) {
            if (!consumer.dirty) {
                consumerMarkDirty(consumer);
            }
        }
    }
    finally {
        inNotificationPhase = prev;
    }
}
/**
 * Whether this `ReactiveNode` in its producer capacity is currently allowed to initiate updates,
 * based on the current consumer context.
 */
export function producerUpdatesAllowed() {
    return activeConsumer?.consumerAllowSignalWrites !== false;
}
export function consumerMarkDirty(node) {
    node.dirty = true;
    producerNotifyConsumers(node);
    node.consumerMarkedDirty?.(node);
}
/**
 * Prepare this consumer to run a computation in its reactive context.
 *
 * Must be called by subclasses which represent reactive computations, before those computations
 * begin.
 */
export function consumerBeforeComputation(node) {
    node && (node.nextProducerIndex = 0);
    return setActiveConsumer(node);
}
/**
 * Finalize this consumer's state after a reactive computation has run.
 *
 * Must be called by subclasses which represent reactive computations, after those computations
 * have finished.
 */
export function consumerAfterComputation(node, prevConsumer) {
    setActiveConsumer(prevConsumer);
    if (!node || node.producerNode === undefined || node.producerIndexOfThis === undefined ||
        node.producerLastReadVersion === undefined) {
        return;
    }
    if (consumerIsLive(node)) {
        // For live consumers, we need to remove the producer -> consumer edge for any stale producers
        // which weren't dependencies after the recomputation.
        for (let i = node.nextProducerIndex; i < node.producerNode.length; i++) {
            producerRemoveLiveConsumerAtIndex(node.producerNode[i], node.producerIndexOfThis[i]);
        }
    }
    // Truncate the producer tracking arrays.
    // Perf note: this is essentially truncating the length to `node.nextProducerIndex`, but
    // benchmarking has shown that individual pop operations are faster.
    while (node.producerNode.length > node.nextProducerIndex) {
        node.producerNode.pop();
        node.producerLastReadVersion.pop();
        node.producerIndexOfThis.pop();
    }
}
/**
 * Determine whether this consumer has any dependencies which have changed since the last time
 * they were read.
 */
export function consumerPollProducersForChange(node) {
    assertConsumerNode(node);
    // Poll producers for change.
    for (let i = 0; i < node.producerNode.length; i++) {
        const producer = node.producerNode[i];
        const seenVersion = node.producerLastReadVersion[i];
        // First check the versions. A mismatch means that the producer's value is known to have
        // changed since the last time we read it.
        if (seenVersion !== producer.version) {
            return true;
        }
        // The producer's version is the same as the last time we read it, but it might itself be
        // stale. Force the producer to recompute its version (calculating a new value if necessary).
        producerUpdateValueVersion(producer);
        // Now when we do this check, `producer.version` is guaranteed to be up to date, so if the
        // versions still match then it has not changed since the last time we read it.
        if (seenVersion !== producer.version) {
            return true;
        }
    }
    return false;
}
/**
 * Disconnect this consumer from the graph.
 */
export function consumerDestroy(node) {
    assertConsumerNode(node);
    if (consumerIsLive(node)) {
        // Drop all connections from the graph to this node.
        for (let i = 0; i < node.producerNode.length; i++) {
            producerRemoveLiveConsumerAtIndex(node.producerNode[i], node.producerIndexOfThis[i]);
        }
    }
    // Truncate all the arrays to drop all connection from this node to the graph.
    node.producerNode.length = node.producerLastReadVersion.length = node.producerIndexOfThis.length =
        0;
    if (node.liveConsumerNode) {
        node.liveConsumerNode.length = node.liveConsumerIndexOfThis.length = 0;
    }
}
/**
 * Add `consumer` as a live consumer of this node.
 *
 * Note that this operation is potentially transitive. If this node becomes live, then it becomes
 * a live consumer of all of its current producers.
 */
function producerAddLiveConsumer(node, consumer, indexOfThis) {
    assertProducerNode(node);
    assertConsumerNode(node);
    if (node.liveConsumerNode.length === 0) {
        node.watched?.call(node.wrapper);
        // When going from 0 to 1 live consumers, we become a live consumer to our producers.
        for (let i = 0; i < node.producerNode.length; i++) {
            node.producerIndexOfThis[i] = producerAddLiveConsumer(node.producerNode[i], node, i);
        }
    }
    node.liveConsumerIndexOfThis.push(indexOfThis);
    return node.liveConsumerNode.push(consumer) - 1;
}
/**
 * Remove the live consumer at `idx`.
 */
export function producerRemoveLiveConsumerAtIndex(node, idx) {
    assertProducerNode(node);
    assertConsumerNode(node);
    if (typeof ngDevMode !== 'undefined' && ngDevMode && idx >= node.liveConsumerNode.length) {
        throw new Error(`Assertion error: active consumer index ${idx} is out of bounds of ${node.liveConsumerNode.length} consumers)`);
    }
    if (node.liveConsumerNode.length === 1) {
        // When removing the last live consumer, we will no longer be live. We need to remove
        // ourselves from our producers' tracking (which may cause consumer-producers to lose
        // liveness as well).
        node.unwatched?.call(node.wrapper);
        for (let i = 0; i < node.producerNode.length; i++) {
            producerRemoveLiveConsumerAtIndex(node.producerNode[i], node.producerIndexOfThis[i]);
        }
    }
    // Move the last value of `liveConsumers` into `idx`. Note that if there's only a single
    // live consumer, this is a no-op.
    const lastIdx = node.liveConsumerNode.length - 1;
    node.liveConsumerNode[idx] = node.liveConsumerNode[lastIdx];
    node.liveConsumerIndexOfThis[idx] = node.liveConsumerIndexOfThis[lastIdx];
    // Truncate the array.
    node.liveConsumerNode.length--;
    node.liveConsumerIndexOfThis.length--;
    // If the index is still valid, then we need to fix the index pointer from the producer to this
    // consumer, and update it from `lastIdx` to `idx` (accounting for the move above).
    if (idx < node.liveConsumerNode.length) {
        const idxProducer = node.liveConsumerIndexOfThis[idx];
        const consumer = node.liveConsumerNode[idx];
        assertConsumerNode(consumer);
        consumer.producerIndexOfThis[idxProducer] = idx;
    }
}
function consumerIsLive(node) {
    return node.consumerIsAlwaysLive || (node?.liveConsumerNode?.length ?? 0) > 0;
}
export function assertConsumerNode(node) {
    node.producerNode ??= [];
    node.producerIndexOfThis ??= [];
    node.producerLastReadVersion ??= [];
}
export function assertProducerNode(node) {
    node.liveConsumerNode ??= [];
    node.liveConsumerIndexOfThis ??= [];
}
//# sourceMappingURL=graph.js.map