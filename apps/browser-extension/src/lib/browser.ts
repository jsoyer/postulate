/**
 * Cross-browser compatibility shim.
 *
 * In Chrome the `chrome` namespace is available natively with Promise support.
 * In Firefox the `browser` namespace is provided by webextension-polyfill.
 * This module exports a single `browser` alias that works in both.
 *
 * In test environments (where `chrome` is mocked via globalThis), this
 * returns the mock directly without loading the polyfill.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _g = globalThis as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const browser: typeof chrome =
  typeof _g.chrome !== "undefined" && _g.chrome.runtime
    ? _g.chrome
    : typeof _g.browser !== "undefined"
      ? _g.browser
      : (() => {
          throw new Error(
            "No browser extension API available. This module must run in Chrome, Firefox, or a mocked test environment."
          )
        })()
