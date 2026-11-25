import { PDFDocument, StandardFonts } from 'pdf-lib'
import { canvasToBlob, renderPage, safeText } from './pdf'
import { extractRuns } from './runs'

function toGray(canvas, threshold) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    let l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (threshold != null) l = l >= threshold ? 255 : 0
    d[i] = d[i + 1] = d[i + 2] = l
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Convierte páginas de un PDF en imágenes y arma un PDF nuevo.
 * mode: 'color' | 'gray' | 'bw'. keepText añade una capa de texto invisible (seleccionable/buscable).
 * beforeEncode(canvas, n, scale) permite dibujar encima (p. ej. censurar).
 */
export async function rasterizePdf(pdf, { scale = 1.3, q = 0.7, mode = 'color', threshold = 160, keepText = false, pages, onProgress, beforeEncode, skipText } = {}) {
  const out = await PDFDocument.create()
  const font = keepText ? await out.embedFont(StandardFonts.Helvetica) : null
  const list = pages || Array.from({ length: pdf.pages }, (_, i) => i + 1)
  let done = 0
  for (const n of list) {
    const pg = await pdf.doc.getPage(n)
    const vp = pg.getViewport({ scale: 1 })
    const canvas = await renderPage(pdf.doc, n, { scale })
    if (mode !== 'color') toGray(canvas, mode === 'bw' ? threshold : null)
    beforeEncode?.(canvas, n, scale)
    const img = await out.embedJpg(await (await canvasToBlob(canvas, 'image/jpeg', q)).arrayBuffer())
    const page = out.addPage([vp.width, vp.height])
    page.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height })
    if (keepText && !pg.rotate && !skipText?.has(n)) {
      try {
        for (const r of await extractRuns(pg, vp.height)) {
          const t = safeText(font, r.str)
          if (t.trim()) page.drawText(t, { x: r.x, y: vp.height - r.base, size: Math.max(1, r.size), font, opacity: 0 })
        }
      } catch { /* sin capa de texto */ }
    }
    canvas.width = canvas.height = 0
    onProgress?.(++done, list.length)
  }
  return out
}

/** Devuelve un PDF con las páginas `pages` (1-based) sustituidas por las de `rdoc` (en orden) y el resto intactas. */
export async function mergeReplaced(srcBytes, rdoc, pages) {
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const map = new Map(pages.map((n, i) => [n, i]))
  for (let i = 0; i < src.getPageCount(); i++) {
    const [p] = map.has(i + 1) ? await out.copyPages(rdoc, [map.get(i + 1)]) : await out.copyPages(src, [i])
    out.addPage(p)
  }
  return out
}
