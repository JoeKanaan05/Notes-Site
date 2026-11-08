// Client-side UI behaviour for the custom theme (styles in quartz/styles/custom.scss).
// Inlined into <head> by Head.tsx as a classic script with `data-persist`, so it runs
// once and survives SPA navigation. Kept as a plain-JS string: this repo has no
// typings/bundling path for `.inline.ts` imports in components.
//
// Avoid cancelable (non-passive) scroll/touch listeners: they make the browser wait
// for script on every scroll event (that made the sidebar laggy, so its scroll
// containment is CSS; see "Scroll containment" in custom.scss). The one exception is
// the mobile search sheet's touch guard below, which only does work while the sheet
// is open on a phone, because nothing else stops iOS panning the page.
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

  // With the keyboard up, iOS shrinks the visible area (the visual viewport) without
  // shrinking the page, and can slide it. The sheet covers the whole page; these
  // insets keep its contents inside the visible part: --vv-top is how far the view
  // has slid down, --kb how much is hidden at the bottom (the keyboard).
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

  // Touch guard. While the keyboard is up, iOS lets a drag pan the page underneath
  // even with overflow: hidden and touch-action: none, which dragged the search
  // field off screen and exposed the page. So cancel any drag on the open sheet,
  // except where something should move:
  //   - inside the results list, while it can still scroll that way (and then the
  //     keyboard is dismissed, like iOS apps do);
  //   - on the search field when it has text (moving the cursor / selecting).
  const canScroll = (list, dy) =>
    list.scrollHeight > list.clientHeight + 1 &&
    (dy < 0 ? list.scrollTop > 0 : list.scrollTop + list.clientHeight < list.scrollHeight - 1)

  const guardTouches = (sheet) => {
    let startX = 0
    let startY = 0
    sheet.addEventListener(
      "touchstart",
      (event) => {
        startX = event.touches[0].clientX
        startY = event.touches[0].clientY
      },
      { passive: true },
    )
    sheet.addEventListener(
      "touchmove",
      (event) => {
        if (sheet !== openSheet || !event.cancelable) return
        const target = event.target instanceof Element ? event.target : sheet
        const field = sheet.querySelector(".search-bar")
        if (target === field && field.value) return
        const dx = startX - event.touches[0].clientX
        const dy = startY - event.touches[0].clientY
        const list = target.closest(".results-container")
        if (list && Math.abs(dy) >= Math.abs(dx) && canScroll(list, dy)) {
          if (field && document.activeElement === field) field.blur()
          return
        }
        event.preventDefault()
      },
      { passive: false },
    )
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
      guardTouches(sheet)
    }
    if (openSheet && !openSheet.isConnected) openSheet = null
  }

  document.addEventListener("nav", () => {
    replayEntrance()
    setUpSearch()
  })
})()
`
