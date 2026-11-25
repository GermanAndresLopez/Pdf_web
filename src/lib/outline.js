import { PDFHexString, PDFName } from 'pdf-lib'

/** Escribe el índice (marcadores) del PDF. items: [{ title, page (1-based), level (0..n) }] */
export function setOutline(doc, items) {
  const ctx = doc.context
  const pages = doc.getPages()
  const catalog = doc.catalog
  if (!items.length) {
    catalog.delete(PDFName.of('Outlines'))
    return
  }
  const rootRef = ctx.nextRef()
  const top = []
  const stack = [{ level: -1, children: top }]
  for (const it of items) {
    const node = { ...it, ref: ctx.nextRef(), children: [] }
    while (stack[stack.length - 1].level >= it.level) stack.pop()
    stack[stack.length - 1].children.push(node)
    stack.push({ level: it.level, children: node.children })
  }
  const count = (nodes) => nodes.reduce((s, n) => s + 1 + count(n.children), 0)
  const emit = (nodes, parentRef) => {
    nodes.forEach((n, i) => {
      const page = pages[Math.min(pages.length, Math.max(1, n.page)) - 1]
      const dict = {
        Title: PDFHexString.fromText(n.title || 'Sin título'),
        Parent: parentRef,
        Dest: [page.ref, 'Fit'],
      }
      if (i > 0) dict.Prev = nodes[i - 1].ref
      if (i < nodes.length - 1) dict.Next = nodes[i + 1].ref
      if (n.children.length) {
        dict.First = n.children[0].ref
        dict.Last = n.children[n.children.length - 1].ref
        dict.Count = count(n.children)
      }
      ctx.assign(n.ref, ctx.obj(dict))
      emit(n.children, n.ref)
    })
  }
  emit(top, rootRef)
  ctx.assign(rootRef, ctx.obj({ Type: 'Outlines', First: top[0].ref, Last: top[top.length - 1].ref, Count: count(top) }))
  catalog.set(PDFName.of('Outlines'), rootRef)
  catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'))
}
