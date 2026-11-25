import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx'
import { pageLines, toGrid } from './runs'
import { renderPage } from './pdf'

const median = (a) => {
  const s = [...a].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : 12
}
const BULLET = /^[•·▪◦‣●○■□\-–—*]\s+/
const NUMBERED = /^(\d+|[a-zA-Z])[.)]\s+/

const lineText = (l) => l.cells.map((c) => c.text).join(' ')
const lineWidth = (l) => l.cells[l.cells.length - 1].x + l.cells[l.cells.length - 1].w - l.cells[0].x

/**
 * PDF → DOCX reconstruyendo párrafos, títulos, listas y tablas a partir del texto.
 * opciones: pages (números 1-based), keepBreaks, tables, lists, ocr ({ lang, scale }) para páginas sin texto.
 */
export async function pdfToDocx(pdf, { pages, keepBreaks = false, tables = true, lists = true, ocr = null, onProgress } = {}) {
  const list = pages || Array.from({ length: pdf.pages }, (_, i) => i + 1)
  const data = []
  for (const [k, n] of list.entries()) {
    data.push({ n, lines: await pageLines(pdf.doc, n) })
    onProgress?.((k + 1) / (list.length * (ocr ? 2 : 1)), `Leyendo texto de la página ${n}`)
  }
  const body = median(data.flatMap((d) => d.lines.map((l) => l.size)))
  const children = []
  let worker = null

  try {
    for (const [k, d] of data.entries()) {
      let first = true
      const push = (el) => { children.push(el); first = false }
      const para = (text, opts = {}, run = {}) =>
        new Paragraph({ pageBreakBefore: first && k > 0, spacing: { after: 120 }, ...opts, children: [new TextRun({ text, ...run })] })

      if (!d.lines.length) {
        if (!ocr) continue
        if (!worker) worker = await (await import('./ocr')).createOcr(ocr.lang)
        const canvas = await renderPage(pdf.doc, d.n, { scale: ocr.scale || 2 })
        const { data: r } = await worker.recognize(canvas)
        canvas.width = canvas.height = 0
        ;(r.text || '').trim().split(/\n{2,}/).filter(Boolean).forEach((t) => push(para(t.replace(/\n/g, ' ').trim())))
        onProgress?.(0.5 + (k + 1) / (data.length * 2), `Reconociendo texto (OCR) de la página ${d.n}`)
        continue
      }

      const maxW = Math.max(1, ...d.lines.map(lineWidth))
      let buf = null
      const flush = () => {
        if (!buf) return
        push(
          buf.bullet
            ? new Paragraph({ pageBreakBefore: first && k > 0, bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: buf.text, size: Math.round(buf.size * 2) })] })
            : para(buf.text, { spacing: { after: buf.heading ? 160 : 120, before: buf.heading ? 200 : 0 } }, { bold: buf.heading, size: Math.round(buf.size * 2) }),
        )
        buf = null
      }

      for (let i = 0; i < d.lines.length; i++) {
        const l = d.lines[i]
        // Tabla: varias líneas seguidas con 2 o más celdas
        if (tables && l.cells.length >= 2) {
          let j = i
          while (j + 1 < d.lines.length && d.lines[j + 1].cells.length >= 2 && d.lines[j].y - d.lines[j + 1].y < d.lines[j].size * 2.6) j++
          if (j > i) {
            flush()
            const grid = toGrid(d.lines.slice(i, j + 1))
            if (grid[0] && grid[0].length >= 2) {
              if (first && k > 0) push(new Paragraph({ pageBreakBefore: true, children: [] }))
              push(new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: grid.map((row) => new TableRow({ children: row.map((c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, size: Math.round(Math.min(l.size, body * 1.1) * 2) })] })] })) })),
              }))
              push(new Paragraph({ children: [] }))
              i = j
              continue
            }
          }
        }
        const prev = d.lines[i - 1]
        const text = lineText(l)
        const heading = l.size >= body * 1.25
        const isBullet = lists && BULLET.test(text)
        const isNumbered = lists && NUMBERED.test(text)
        const gap = prev ? prev.y - l.y : 0
        const continues = !keepBreaks && buf && !buf.heading && !buf.bullet && !heading && !isBullet && !isNumbered && lineWidth(prev) >= maxW * 0.75 && gap <= l.size * 1.5 && Math.abs(prev.size - l.size) < 1.5
        if (continues) buf.text = buf.text.endsWith('-') ? buf.text.slice(0, -1) + text : buf.text + ' ' + text
        else {
          flush()
          buf = { text: isBullet ? text.replace(BULLET, '') : text, size: heading ? l.size : Math.min(l.size, body * 1.1), heading, bullet: isBullet }
        }
      }
      flush()
      onProgress?.(ocr ? 0.5 + (k + 1) / (data.length * 2) : 1, '')
    }
  } finally {
    await worker?.terminate()
  }

  if (!children.length) throw new Error('No se encontró texto seleccionable. Activa el OCR para procesar documentos escaneados.')
  return Packer.toBlob(new Document({ sections: [{ children }] }))
}
