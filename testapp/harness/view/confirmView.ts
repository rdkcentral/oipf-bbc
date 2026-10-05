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
 * ConfirmView (View) — a small modal with a Yes/No choice, used for the exit
 * confirmation shown when Back is pressed with no drill-down history left. Owns
 * which button has focus; the controller decides when to open it and what
 * accepting/cancelling means. opts.onConfirm/onCancel exist only for the
 * click listeners below — keyboard input is handled entirely by the
 * controller, which reads isYesFocused() and calls its own exit logic
 * directly, without going through this view.
 */
export interface ConfirmView {
    open: (message: string) => void;
    close: () => void;
    toggleFocus: () => void;
    isYesFocused: () => boolean;
}

export interface ConfirmViewOpts {
    onConfirm: () => void;
    onCancel: () => void;
}

export function createConfirmView(opts: ConfirmViewOpts): ConfirmView {
    const onConfirm = opts.onConfirm;
    const onCancel = opts.onCancel;

    const overlay = document.getElementById('exitConfirm')!;
    const messageEl = document.getElementById('exitConfirmMessage')!;
    const yesEl = document.getElementById('exitConfirmYes')!;
    const noEl = document.getElementById('exitConfirmNo')!;

    let yesFocused = false; // default to "No" — exiting is the destructive choice

    function repaintFocus(): void {
        yesEl.classList.toggle('focused', yesFocused);
        noEl.classList.toggle('focused', !yesFocused);
    }

    function open(message: string): void {
        messageEl.textContent = message;
        yesFocused = false;
        repaintFocus();
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
    }

    function close(): void {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
    }

    function toggleFocus(): void {
        yesFocused = !yesFocused;
        repaintFocus();
    }

    yesEl.addEventListener('click', function () {
        yesFocused = true;
        repaintFocus();
        onConfirm();
    });
    noEl.addEventListener('click', function () {
        yesFocused = false;
        repaintFocus();
        onCancel();
    });

    return {
        open: open,
        close: close,
        toggleFocus: toggleFocus,
        isYesFocused: function () {
            return yesFocused;
        }
    };
}
