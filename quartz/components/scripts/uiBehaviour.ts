// Client-side UI behaviour for the custom theme (styles in quartz/styles/custom.scss).
// Inlined into <head> by Head.tsx as a classic script with `data-persist`, so it runs
// once and survives SPA navigation. Kept as a plain-JS string: this repo has no
// typings/bundling path for `.inline.ts` imports in components.
//
// Scroll containment (sidebar, search, mobile menu) is done in CSS, not here: a
// cancelable wheel/touch listener makes the browser wait for script on every scroll
// event and made sidebar scrolling laggy. See "Scroll containment" in custom.scss.
export const uiBehaviourScript = `
(() => {
  // Page entrance animation. SPA navigation morphs the page in place, so the CSS
  // animation would only play on the first load; re-add the class on every "nav".
  document.addEventListener("nav", () => {
    for (const el of document.querySelectorAll(".center, .page-header")) {
      el.classList.remove("page-enter")
      void el.offsetWidth
      el.classList.add("page-enter")
    }
  })
})()
`
