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

  // 3. Home page archive (styles in custom.scss, section 15): every note as a file
  //    row under its folder's divider; hovering or focusing a file pulls it up into
  //    the card. Data: the slim content index (\`fetchData\`, renderPage.tsx); the
  //    card's text is the note's meta description, fetched on first hover.
  const descriptions = new Map()
  const describe = (href) => {
    if (!descriptions.has(href)) {
      descriptions.set(
        href,
        fetch(href)
          .then((res) => res.text())
          .then((html) => {
            const doc = new DOMParser().parseFromString(html, "text/html")
            return doc.querySelector('meta[name="description"]')?.content ?? ""
          })
          .catch(() => ""),
      )
    }
    return descriptions.get(href)
  }

  const make = (tag, className, text) => {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  const makeTab = (label, count) => {
    const tab = make("span", "archive-tab")
    const inner = make("span", "archive-tab-inner")
    inner.append(make("span", "", label))
    if (count !== undefined) inner.append(make("span", "", count))
    tab.append(inner)
    return tab
  }

  // Groups index entries by folder (from filePath, which keeps the real casing),
  // folders and files in natural order. The home page, tag pages and generated
  // folder pages (slugs ending in /index) are left out.
  const groupByFolder = (content) => {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
    const groups = new Map()
    for (const [slug, file] of Object.entries(content)) {
      const path = file.filePath ?? ""
      if (slug === "index" || slug.endsWith("/index") || slug.startsWith("tags/")) continue
      const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "Notes"
      if (!groups.has(folder)) groups.set(folder, [])
      groups.get(folder).push({ slug, title: file.title || slug })
    }
    for (const files of groups.values()) files.sort((a, b) => collator.compare(a.title, b.title))
    return [...groups].sort(([a], [b]) => collator.compare(a, b))
  }

  // Narrower towards the top, widest at the base; only visible rows count.
  const restack = (stack) => {
    const rows = [...stack.querySelectorAll(".archive-row")].filter((row) => row.getClientRects().length)
    rows.forEach((row, i) => row.style.setProperty("--d", String(Math.min(rows.length - 1 - i, 10))))
  }

  const buildArchive = async () => {
    if (document.body.dataset.slug !== "index" || typeof fetchData === "undefined") return
    const center = document.querySelector(".center")
    if (!center || center.querySelector(".archive")) return
    const groups = groupByFolder((await fetchData).content)
    // Navigated away (or built twice) while the index was loading.
    if (!center.isConnected || center.querySelector(".archive")) return

    const total = groups.reduce((sum, [, files]) => sum + files.length, 0)
    const pad = (n) => String(n).padStart(String(total).length, "0")
    const archive = make("section", "archive")
    archive.setAttribute("aria-label", "All notes")

    const card = make("div", "archive-card")
    const rec = make("div", "archive-card-rec", "REC " + "-".repeat(String(total).length) + " / " + pad(total))
    const title = make("div", "archive-card-title", "Pick a file")
    const text = make("p", "archive-card-text", "Open a folder, then hover a file to pull it out of the archive.")
    const foot = make("div", "archive-card-foot")
    const where = make("span", "", groups.length + " folders / " + total + " files")
    foot.append(where, make("span", "archive-cursor"))
    card.append(rec, title, text, foot)

    const stack = make("div", "archive-stack")
    let n = 0
    for (const [folder, files] of groups) {
      const group = make("details", "archive-folder")
      const summary = make("summary", "archive-row archive-row-folder")
      summary.dataset.pos = String(n % 3)
      summary.append(makeTab(folder.split("/").join(" / "), String(files.length).padStart(2, "0")))
      group.append(summary)
      for (const file of files) {
        n++
        const row = make("a", "archive-row archive-file")
        row.href = "./" + file.slug
        row.dataset.pos = String(n % 3)
        row.dataset.rec = pad(n)
        row.dataset.folder = folder.split("/").join(" / ")
        row.append(makeTab(file.title))
        group.append(row)
      }
      stack.append(group)
    }
    stack.append(make("div", "archive-base", "Archive / " + total + " files"))

    let current = null
    const show = (row) => {
      if (!row || row === current) return
      current = row
      rec.textContent = "REC " + row.dataset.rec + " / " + pad(total)
      title.textContent = row.textContent
      where.textContent = row.dataset.folder
      text.textContent = ""
      card.classList.remove("pulled")
      void card.offsetWidth
      card.classList.add("pulled")
      // A short wait, so sweeping the pointer down the stack doesn't fetch every page.
      setTimeout(() => {
        if (current !== row) return
        describe(row.href).then((description) => {
          if (current === row) text.textContent = description || "No description."
        })
      }, 120)
    }
    stack.addEventListener("pointerover", (event) => show(event.target.closest(".archive-file")))
    stack.addEventListener("focusin", (event) => show(event.target.closest(".archive-file")))
    // "toggle" doesn't bubble, hence the capture listener.
    stack.addEventListener("toggle", () => restack(stack), true)

    archive.append(card, stack)
    center.querySelector("article")?.before(archive)
    restack(stack)
  }

  document.addEventListener("nav", () => {
    replayEntrance()
    setUpSearch()
    buildArchive()
  })
})()
`
