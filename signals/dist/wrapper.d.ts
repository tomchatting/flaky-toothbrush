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
import { type ComputedNode } from "./computed.js";
import { type ReactiveNode } from "./graph.js";
import { type SignalNode } from "./signal.js";
declare const NODE: unique symbol;
export declare namespace Signal {
    export class State<T> {
        #private;
        readonly [NODE]: SignalNode<T>;
        constructor(initialValue: T, options?: Signal.Options<T>);
        get(): T;
        set(newValue: T): void;
    }
    export class Computed<T> {
        #private;
        readonly [NODE]: ComputedNode<T>;
        constructor(computation: () => T, options?: Signal.Options<T>);
        get(): T;
    }
    type AnySignal<T = any> = State<T> | Computed<T>;
    type AnySink = Computed<any> | subtle.Watcher;
    export namespace subtle {
        function untrack<T>(cb: () => T): T;
        function introspectSources(sink: AnySink): AnySignal[];
        function introspectSinks(signal: AnySignal): AnySink[];
        function hasSinks(signal: AnySignal): boolean;
        function hasSources(signal: AnySink): boolean;
        class Watcher {
            #private;
            readonly [NODE]: ReactiveNode;
            constructor(notify: (this: Watcher) => void);
            watch(...signals: AnySignal[]): void;
            unwatch(...signals: AnySignal[]): void;
            getPending(): Computed<any>[];
        }
        function currentComputed(): Computed<any> | undefined;
        const watched: unique symbol;
        const unwatched: unique symbol;
    }
    export interface Options<T> {
        equals?: (this: AnySignal<T>, t: T, t2: T) => boolean;
        [Signal.subtle.watched]?: (this: AnySignal<T>) => void;
        [Signal.subtle.unwatched]?: (this: AnySignal<T>) => void;
    }
    export {};
}
export {};
//# sourceMappingURL=wrapper.d.ts.map