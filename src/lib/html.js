import html2canvas from 'html2canvas'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { canvasToBlob, safeText } from './pdf'

const SIZES = {
  a4: { w: 794, h: 1123, pw: 595.28, ph: 841.89 },
  letter: { w: 816, h: 1056, pw: 612, ph: 792 },
  legal: { w: 816, h: 1344, pw: 612, ph: 1008 },
}
const FONTS = {
  serif: "Georgia,'Times New Roman',serif",
  sans: 'Helvetica,Arial,sans-serif',
  mono: "'Courier New',monospace",
}

function findBreak(ctx, width, end, minY) {
  for (let y = end; y > minY; y--) {
    const d = ctx.getImageData(0, y, width, 1).data
    let white = true
    for (let i = 0; i < d.length; i += 8) {
      if (d[i] < 246 || d[i + 1] < 246 || d[i + 2] < 246) { white = false; break }
    }
    if (white) return y
  }
  return end
}

function collectWords(host) {
  const hr = host.getBoundingClientRect()
  const out = []
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('style,script')) continue
    const re = /\S+/g
    let m
    while ((m = re.exec(node.nodeValue))) {
      range.setStart(node, m.index)
      range.setEnd(node, m.index + m[0].length)
      const r = range.getBoundingClientRect()
      if (r.width && r.height) out.push({ s: m[0], x: r.left - hr.left, y: r.top - hr.top, w: r.width, h: r.height })
      if (out.length > 30000) return out
    }
  }
  return out
}

/**
 * Convierte HTML en un PDF paginado. Las páginas son imágenes con una capa de texto invisible
 * (selectable=true) para poder buscar y copiar el texto.
 */
export async function htmlToPdf(html, { fontSize = 14, pageSize = 'a4', landscape = false, margin = 56, selectable = true, lineHeight = 1.55, font = 'serif' } = {}) {
  let { w: W, h: H, pw: PT_W, ph: PT_H } = SIZES[pageSize] || SIZES.a4
  if (landscape) { [W, H] = [H, W]; [PT_W, PT_H] = [PT_H, PT_W] }
  const PAD = margin

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;background:#fff;color:#111;padding:0 ${PAD}px;box-sizing:border-box;font:${fontSize}px/${lineHeight} ${FONTS[font] || FONTS.serif};`
  host.innerHTML =
    `<style>h1,h2,h3,h4{font-family:Helvetica,Arial,sans-serif;line-height:1.25;margin:1em 0 .4em}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px;vertical-align:top}img{max-width:100%;height:auto}p{margin:0 0 .8em}ul,ol{padding-left:1.4em}pre{white-space:pre-wrap}</style>` +
    sanitizeHtml(html)
  document.body.appendChild(host)
  try {
    await Promise.all([...host.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r }))))
    if (!host.scrollHeight) throw new Error('El documento está vacío.')

    // Si el contenido (p. ej. una tabla) es más ancho que la página, se reduce para que quepa
    const Wc = Math.max(W, host.scrollWidth > W ? host.scrollWidth + PAD : W)
    host.style.width = Wc + 'px'
    const ratio = Wc / W
    const cssK = PT_W / Wc // pt por píxel CSS
    const topPt = PAD * (PT_W / W)

    const words = selectable ? collectWords(host) : []
    const scale = Math.max(0.8, Math.min(2, 30000 / host.scrollHeight))
    const canvas = await html2canvas(host, { scale, backgroundColor: '#fff', useCORS: true, width: Wc, windowWidth: Wc })
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const out = await PDFDocument.create()
    const tfont = words.length ? await out.embedFont(StandardFonts.Helvetica) : null
    const sliceH = (H - 2 * PAD) * ratio * scale
    const k = cssK / scale // pt por píxel de canvas
    let y = 0
    while (y < canvas.height) {
      let end = Math.min(y + sliceH, canvas.height)
      if (end < canvas.height) end = Math.floor(findBreak(ctx, canvas.width, Math.floor(end), Math.max(y + 1, Math.floor(end - 140 * scale))))
      const h = Math.max(1, end - y)
      const tmp = document.createElement('canvas')
      tmp.width = canvas.width
      tmp.height = h
      const t = tmp.getContext('2d')
      t.fillStyle = '#fff'
      t.fillRect(0, 0, tmp.width, h)
      t.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
      const img = await out.embedJpg(await (await canvasToBlob(tmp, 'image/jpeg', 0.92)).arrayBuffer())
      const page = out.addPage([PT_W, PT_H])
      page.drawImage(img, { x: 0, y: PT_H - topPt - h * k, width: canvas.width * k, height: h * k })

      if (tfont) {
        const ys = y / scale
        const ye = end / scale
        for (const w of words) {
          const cy = w.y + w.h / 2
          if (cy < ys || cy >= ye) continue
          const text = safeText(tfont, w.s)
          if (!text.replace(/\?/g, '')) continue
          page.drawText(text, { x: w.x * cssK, y: PT_H - topPt - (w.y + w.h * 0.82 - ys) * cssK, size: Math.max(1, w.h * 0.78 * cssK), font: tfont, opacity: 0 })
        }
      }
      y = end
    }
    if (!out.getPageCount()) out.addPage([PT_W, PT_H])
    return await out.save()
  } finally {
    host.remove()
  }
}

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Elimina scripts, manejadores on*, iframes y URLs javascript: antes de insertar HTML externo. */
export function sanitizeHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed,link,meta,base,form,frame,frameset').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase()
      if (n.startsWith('on') || (['href', 'src', 'xlink:href', 'srcset', 'action', 'formaction'].includes(n) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value))) el.removeAttribute(a.name)
    }
  })
  return doc.body.innerHTML
}
