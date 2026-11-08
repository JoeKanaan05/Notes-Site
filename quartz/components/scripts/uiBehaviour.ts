// Client-side UI behaviour for the custom theme (styles in quartz/styles/custom.scss).
// Inlined into <head> by Head.tsx as a classic script with `data-persist`, so it runs
// once and survives SPA navigation. Kept as a plain-JS string: this repo has no
// typings/bundling path for `.inline.ts` imports in components.
//
// Nothing here registers a cancelable (non-passive) scroll or touch listener: those
// make the browser wait for script on every scroll event and made the sidebar laggy.
// Scroll containment is done in CSS (see "Scroll containment" in custom.scss).
export const uiBehaviourScript = `
(() => {
  // 1. Page entrance animation. SPA navigation morphs the page in place, so the CSS
  //    animation would only play on the first load; re-add the class on every "nav".
  const replayEntrance = () => {
    for (const el of document.querySelectorAll(".center, .page-header")) {
      el.classList.remove("page-enter")
      void el.offsetWidth
      el.classList.add("page-enter")
    }
  }

  // 2. Mobile search sheet (layout in custom.scss, section 13).
  const phone = window.matchMedia("(max-width: 800px)")
  const vv = window.visualViewport
  let openSheet = null

  // Keep the sheet inside the visible area: with the keyboard up, iOS shrinks the
  // visible area (the visual viewport) without shrinking the page, and may slide it.
  // --vv-top follows any slide; --kb is how much is hidden at the bottom (keyboard).
  const fitToViewport = () => {
    if (!openSheet || !vv) return
    const hiddenBelow = Math.max(0, window.innerHeight - vv.offsetTop - vv.height)
    openSheet.style.setProperty("--vv-top", vv.offsetTop + "px")
    openSheet.style.setProperty("--kb", hiddenBelow + "px")
  }
  if (vv) {
    vv.addEventListener("resize", fitToViewport)
    vv.addEventListener("scroll", fitToViewport)
  }

  const onSearchToggle = (sheet) => {
    if (sheet.classList.contains("active") && phone.matches) {
      openSheet = sheet
      fitToViewport()
    } else if (!sheet.classList.contains("active") && openSheet === sheet) {
      sheet.style.removeProperty("--vv-top")
      sheet.style.removeProperty("--kb")
      openSheet = null
    }
  }

  // The plugin closes search on Escape or a click whose target is the backdrop
  // itself. Phones have no Escape key and the sheet covers the backdrop, so add a
  // Cancel button that closes through the plugin's own handler (a click on the
  // backdrop), which also clears the field and resets its state.
  const addCancelButton = (sheet) => {
    if (sheet.querySelector(":scope > .search-cancel")) return
    const cancel = document.createElement("button")
    cancel.type = "button"
    cancel.className = "search-cancel"
    cancel.textContent = "Cancel"
    cancel.addEventListener("click", (event) => {
      event.stopPropagation()
      sheet.click()
    })
    sheet.appendChild(cancel)
  }

  // App-like keyboard: a "Search" return key, no autocorrect or auto-capitals.
  const tuneField = (sheet) => {
    const field = sheet.querySelector(".search-bar")
    if (!field) return
    field.setAttribute("enterkeyhint", "search")
    field.setAttribute("autocapitalize", "off")
    field.setAttribute("autocorrect", "off")
    field.setAttribute("spellcheck", "false")
  }

  const watched = new WeakSet()
  const setUpSearch = () => {
    for (const sheet of document.querySelectorAll(".search-container")) {
      // Navigation re-renders the sidebar from the server HTML, which drops the
      // injected button and attributes, so these run on every navigation.
      addCancelButton(sheet)
      tuneField(sheet)
      if (watched.has(sheet)) continue
      watched.add(sheet)
      new MutationObserver(() => onSearchToggle(sheet)).observe(sheet, {
        attributes: true,
        attributeFilter: ["class"],
      })
      // Like iOS apps: start scrolling the results and the keyboard goes away.
      sheet.addEventListener(
        "touchmove",
        (event) => {
          const field = sheet.querySelector(".search-bar")
          if (
            field &&
            document.activeElement === field &&
            event.target instanceof Element &&
            event.target.closest(".results-container")
          ) {
            field.blur()
          }
        },
        { passive: true },
      )
    }
    if (openSheet && !openSheet.isConnected) openSheet = null
  }

  document.addEventListener("nav", () => {
    replayEntrance()
    setUpSearch()
  })
})()
`
