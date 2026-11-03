// obsidian-flavored-markdown emits `![[x.svg]]` as <object data="x.svg">, but
// crawl-links only resolves paths on img/video/audio/iframe, so the SVG 404s.
// Rewrite those objects as <img> before crawl-links runs (order < 60).

function visit(node, fn) {
  fn(node)
  if (node.children) {
    for (const child of node.children) visit(child, fn)
  }
}

function rehypeSvgEmbeds() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== "element" || node.tagName !== "object") return
      const props = node.properties ?? {}
      if (props.type !== "image/svg+xml" || typeof props.data !== "string") return

      const img = { src: props.data, alt: props.ariaLabel ?? "" }
      // "auto" is the OFM default and isn't a valid dimension attribute
      if (props.width && props.width !== "auto") img.width = props.width
      if (props.height && props.height !== "auto") img.height = props.height

      node.tagName = "img"
      node.properties = img
      node.children = []
    })
  }
}

export default function SvgEmbeds() {
  return {
    name: "SvgEmbeds",
    htmlPlugins() {
      return [rehypeSvgEmbeds]
    },
  }
}
