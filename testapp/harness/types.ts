/*
 * Copyright (c) 2026 Infosys
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

/*
 * Shared domain types for the harness (test catalog, registration API, and the
 * runner/autorun result shapes). Deliberately pragmatic rather than maximally
 * strict — TestGroup mirrors the code's own defensive field-presence checks
 * (`group.naMessage`, `group.cases || []`, `group.autorun`) rather than a fully
 * exhaustive discriminated union, since the shape is still expected to move.
 */

// Sentinel used in a register() path to mean "expand across every interface
// type" — see harness.INTERFACE / tree.js's INTERFACE_TYPES.
export interface InterfacePlaceholder {
    readonly interfacePlaceholder: true;
}

export type PathSegment = string | InterfacePlaceholder;

// Resolves the object a test group runs against; may return a falsy value
// (off-STB / not supported) or throw (the runner treats either as a setup
// failure) — see runner.js's prepare().
export type Accessor<Ctx> = () => Ctx | null | undefined;

export interface Accessors<Ctx> {
    bbc?: Accessor<Ctx>;
    factory?: Accessor<Ctx>;
    dom?: Accessor<Ctx>;
}

export interface TestCase<Ctx = undefined> {
    name: string;
    manual?: boolean;
    run: (ctx: Ctx) => unknown;
}

export interface RegisterSpec<Ctx = undefined> {
    path: PathSegment[];
    accessors?: Accessors<Ctx>;
    cases: TestCase<Ctx>[];
}

// A leaf's runnable group, as stored on TreeNode — exactly one of three shapes,
// each built at exactly one place in harness/model/tree.ts:
//   - RunnableGroup    register()'s literal-path / has-an-accessor cases
//   - UnavailableGroup register()'s no-accessor-for-this-interface cases
//   - AutorunGroup     buildRunAllMenu()'s synthetic "run all" leaves
// Each variant only declares its own fields (no shared optional/undefined
// siblings) so consumers narrow with `'field' in group` — the reliable way to
// discriminate a structural (non-literal-tagged) union in TypeScript — rather
// than a truthiness check, which doesn't narrow these fields reliably since
// their types (string, a function, a TreeNode) aren't literal.
//
// Ctx is erased to `unknown` here rather than `any`: register()'s many callers
// each have their own concrete Ctx (Configuration, ApplicationManager, ...),
// but once stored in the tree nothing downstream (runner/controller/autorun)
// ever needs to know which — they just resolve a ctx and hand it straight back
// to that same leaf's own `run(ctx)`. `unknown` still forces any code that
// *does* try to inspect or call something on a stored cases/setup value to
// cast first, unlike `any`, which would let such a mistake through silently.
// The one legitimate erasure point is tree.ts's register(), where a concrete
// RegisterSpec<Ctx> is deliberately boxed into this generic shape — see the
// `any` there for why that spot is different.
export interface RunnableGroup {
    cases: TestCase<unknown>[];
    setup?: Accessor<unknown>;
}

export interface UnavailableGroup {
    naMessage: string;
}

export interface AutorunGroup {
    autorun: TreeNode;
}

export type TestGroup = RunnableGroup | UnavailableGroup | AutorunGroup;

export interface TreeNode {
    label: string;
    children: TreeNode[];
    index: Record<string, TreeNode>;
    group: TestGroup | null;
    id: string | null;
    subtitle: string | null;
    caption: string | null;
}

export type PrepareResult =
    | { kind: 'unavailable'; message: string }
    | { kind: 'setupFailure'; error: unknown }
    | { kind: 'cases'; cases: TestCase<unknown>[]; ctx: unknown };

export interface ExecuteResult {
    ok: boolean;
    value: unknown;
}

export interface RunPlan {
    total: number;
    manualSkipped: number;
    naCount: number;
    leaves: TreeNode[];
}

export interface AutoRunSummary {
    total: number;
    passed: number;
    failed: number;
    manualSkipped: number;
    naCount: number;
}

export interface ResultEntry {
    index: number;
    total: number;
    path: string | null;
    name: string;
    ok: boolean;
    value: unknown;
}

export interface InitEnv {
    mode: string;
    onesdk?: OneSdk;
}

export interface Harness {
    // Generic (rather than RegisterSpec<any>) so each call site's Ctx is
    // inferred from the accessors/cases actually passed — real type-checking
    // on each test's run(ctx) callback instead of an implicit any.
    register: <Ctx = undefined>(spec: RegisterSpec<Ctx>) => void;
    INTERFACE: InterfacePlaceholder;
    domObjectAccessor: <Ctx>(type: string, id: string) => Accessor<Ctx>;
    init: (env: InitEnv) => void;
    fatal: (message: string) => void;
    log: (text: string, isError?: boolean) => void;
}
