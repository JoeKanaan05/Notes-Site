// Client-side UI behaviour for the custom theme (styles in quartz/styles/custom.scss).
// Inlined into <head> by Head.tsx as a classic script with `data-persist`, so it runs
// once and survives SPA navigation. Kept as a plain-JS string: this repo has no
// typings/bundling path for `.inline.ts` imports in components.
//
// Scroll containment for the sidebar is done in CSS, not here: a cancelable
// wheel/touch listener makes the browser wait for script on every scroll event and
// made sidebar scrolling laggy. See "Scroll containment" in custom.scss. Nothing below
// registers a cancelable scroll listener.
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

  // 2. Mobile search overlay. With the keyboard up, iOS doesn't shrink the page: it
  //    slides the visible area (the "visual viewport") over it, and fixed elements
  //    slide with the page. Scrolling then dragged the search sheet up and showed the
  //    page past the overlay's bottom edge. While search is open on a phone:
  //    - freeze the page underneath (body position: fixed, scroll position restored
  //      on close) so there's nothing for iOS to scroll, and
  //    - pin the overlay to the visual viewport (--vv-top / --vv-height, read by
  //      custom.scss) so it always covers exactly what's on screen, above the keyboard.
  const phone = window.matchMedia("(max-width: 800px)")
  const vv = window.visualViewport
  let openOverlay = null
  let lockedScrollY = null

  const pinToViewport = () => {
    if (!openOverlay || !vv) return
    openOverlay.style.setProperty("--vv-top", vv.offsetTop + "px")
    openOverlay.style.setProperty("--vv-height", vv.height + "px")
  }
  if (vv) {
    vv.addEventListener("resize", pinToViewport)
    vv.addEventListener("scroll", pinToViewport)
  }

  const freezePage = () => {
    if (lockedScrollY !== null) return
    lockedScrollY = window.scrollY
    Object.assign(document.body.style, {
      position: "fixed",
      top: -lockedScrollY + "px",
      left: "0",
      right: "0",
    })
  }
  const unfreezePage = () => {
    if (lockedScrollY === null) return
    Object.assign(document.body.style, { position: "", top: "", left: "", right: "" })
    window.scrollTo({ top: lockedScrollY, behavior: "instant" })
    lockedScrollY = null
  }

  const closeOverlay = () => {
    if (openOverlay) {
      openOverlay.style.removeProperty("--vv-top")
      openOverlay.style.removeProperty("--vv-height")
      openOverlay = null
    }
    unfreezePage()
  }

  const onSearchToggle = (overlay) => {
    const isOpen = overlay.classList.contains("active")
    if (isOpen && phone.matches) {
      openOverlay = overlay
      freezePage()
      pinToViewport()
    } else if (!isOpen && openOverlay === overlay) {
      closeOverlay()
    }
  }

  const watched = new WeakSet()
  const watchSearch = () => {
    for (const overlay of document.querySelectorAll(".search-container")) {
      if (watched.has(overlay)) continue
      watched.add(overlay)
      new MutationObserver(() => onSearchToggle(overlay)).observe(overlay, {
        attributes: true,
        attributeFilter: ["class"],
      })
    }
    // A navigation can replace the overlay while it was open.
    if (openOverlay && !openOverlay.isConnected) closeOverlay()
  }

  document.addEventListener("nav", () => {
    replayEntrance()
    watchSearch()
  })
})()
`
