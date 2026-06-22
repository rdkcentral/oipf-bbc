# Test app — deferred refactors

These are deliberate "right-depth later" items surfaced in code review. None is a
bug, and each would be **refactoring for its own sake today** — the current shape
is fine for one instance of the pattern. Act on an item only when its **trigger**
arrives (a second case that the current shape can't absorb cleanly).

## 1. Generalise actionable nodes/rows beyond ad-hoc markers

**Where:** `harness/controller/controller.js` (`activate`), `harness/view/resultView.js`
(`activateFocused`), `harness/model/tree.js` (`buildRunAllMenu`).

**Now:** "what does OK do on this thing" is encoded as property-presence flags
special-cased in several places — `group.autorun` (a category to autorun),
`row.__reload` (reload button), `row.__armed` (manual case), `row.__inert` (N/A
row). Each new actionable type adds another flag and another branch.

**Trigger:** a *third* actionable node/row type (e.g. a "settings" action, a
"re-run" row, a "copy result" row).

**Direction:** give each focusable/leaf a single `onActivate` handler (or a typed
`kind`), so `activate`/`activateFocused` just invoke it instead of sniffing
`__reload` vs `__armed` vs `__inert` vs scrollable-data.

## 2. Model the popup as an overlay/pane stack, not a flat 4th pane

**Where:** `harness/controller/controller.js` (`pane` enum, `onKeyDown`,
`startAutorun`, `handlePopupKey`).

**Now:** `pane` is a flat enum `'menu' | 'results' | 'popup'`. The popup behaves
like a modal (captures keys, dismiss restores the menu) but on close hardcodes
`pane = 'menu'` — it can't return to whatever pane was active when it opened.

**Trigger:** a second modal/overlay (confirm dialog, help overlay), or launching
autorun from somewhere other than the menu.

**Direction:** push the overlay onto a small pane/overlay stack; route keys to the
top of the stack; pop on dismiss to restore the previous pane automatically.

## 3. Keep the tree append-only; let the view own ordering

**Where:** `harness/model/tree.js` (`buildRunAllMenu` splice/unshift to front).

**Now:** `buildRunAllMenu` mutates the live tree and reorders `root.children` to
pin the "Run all" branch first. It's now idempotent, but display ordering is baked
into the model by mutation, and it assumes it runs after all registration.

**Trigger:** lazy/after-init test registration, or more than one "pinned"
top-level entry whose ordering matters.

**Direction:** keep the model append-only and let the view/controller decide
prominence (e.g. a `pinned` flag on a node, or a display-order list), rather than
the model splicing its own children array.
