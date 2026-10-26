import { FullSlug, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import { ProcessedContent } from "../vfile"
import { BuildCtx } from "../../util/ctx"
import { write } from "./helpers"

// Same entries as static/contentIndex.json (from @quartz-community/content-index),
// minus the full note text. Pages load this up front; the full index is only
// fetched once search is opened (see renderPage.tsx).
const emitSlimIndex = async (ctx: BuildCtx, content: ProcessedContent[]) => {
  const index: Record<string, unknown> = {}
  for (const [, file] of content) {
    const data = file.data
    if (data.unlisted === true || !data.slug) continue
    const frontmatter = (data.frontmatter ?? {}) as Record<string, unknown>
    index[data.slug] = {
      slug: data.slug,
      filePath: data.relativePath,
      title: frontmatter.title ?? "",
      links: data.links ?? [],
      tags: frontmatter.tags ?? [],
    }
  }

  return [
    await write({
      ctx,
      content: JSON.stringify(index),
      slug: joinSegments("static", "contentIndex.slim") as FullSlug,
      ext: ".json",
    }),
  ]
}

export const SlimContentIndex: QuartzEmitterPlugin = () => ({
  name: "SlimContentIndex",
  emit: emitSlimIndex,
  partialEmit: emitSlimIndex,
})
