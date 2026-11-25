// Texto existente de un PDF agrupado en líneas editables (coordenadas SVG: origen arriba-izquierda, en puntos).

export function fontInfo(pg, tc, fontName) {
  let name = ''
  try { name = pg.commonObjs.get(fontName)?.name || '' } catch { /* fuente aún no resuelta */ }
  const n = name.toLowerCase()
  const css = tc.styles?.[fontName]?.fontFamily
  const family = /mono|courier|consolas/.test(n) || css === 'monospace' ? 'mono' : (/times|georgia|garamond|palatino|serif|roman|cambria/.test(n) && !/sans/.test(n)) || css === 'serif' ? 'serif' : 'sans'
  return { family, bold: /bold|black|heavy|semibold|demi/.test(n), italic: /italic|oblique/.test(n) }
}

export async function extractRuns(pg, H) {
  const tc = await pg.getTextContent()
  const runs = []
  let cur = null
  const close = () => {
    if (cur && cur.str.trim()) runs.push({ ...cur, id: runs.length, str: cur.str.replace(/\s+$/, '') })
    cur = null
  }
  for (const it of tc.items) {
    if (!it.str) continue
    const t = it.transform
    if (Math.abs(t[1]) > 0.01 || Math.abs(t[2]) > 0.01) { close(); continue } // texto girado: se omite
    const size = Math.abs(t[3]) || it.height || 10
    const x = t[4]
    const base = H - t[5]
    const gap = cur ? x - (cur.x + cur.w) : 0
    if (cur && Math.abs(base - cur.base) < size * 0.3 && Math.abs(size - cur.size) < size * 0.25 && gap > -size * 0.3 && gap < size * 0.6) {
      if (gap > size * 0.15 && !cur.str.endsWith(' ') && !it.str.startsWith(' ')) cur.str += ' '
      cur.str += it.str
      cur.w = x + it.width - cur.x
    } else {
      close()
      cur = { str: it.str, x, base, size, w: it.width, ...fontInfo(pg, tc, it.fontName) }
    }
  }
  close()
  return runs
}

export async function pageRuns(doc, n) {
  const pg = await doc.getPage(n)
  const vp = pg.getViewport({ scale: 1 })
  return { runs: await extractRuns(pg, vp.height), w: vp.width, h: vp.height, rotated: !!pg.rotate }
}

const hex2 = (n) => n.toString(16).padStart(2, '0')

/** Estima el color de fondo (a la izquierda del texto) y el del texto (el píxel más distinto del fondo). */
export function sampleColors(canvas, k, r) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const cl = (v, max) => Math.max(0, Math.min(max - 1, Math.round(v)))
    const b = ctx.getImageData(cl((r.x - 3) * k, canvas.width), cl((r.y + r.h / 2) * k, canvas.height), 1, 1).data
    const x0 = cl(r.x * k, canvas.width)
    const y0 = cl(r.y * k, canvas.height)
    const w = Math.max(1, Math.min(canvas.width - x0, Math.round(r.w * k)))
    const h = Math.max(1, Math.min(canvas.height - y0, Math.round(r.h * k)))
    const d = ctx.getImageData(x0, y0, w, h).data
    let best = 0
    let fg = [0, 0, 0]
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.abs(d[i] - b[0]) + Math.abs(d[i + 1] - b[1]) + Math.abs(d[i + 2] - b[2])
      if (dist > best) { best = dist; fg = [d[i], d[i + 1], d[i + 2]] }
    }
    if (best < 90) fg = [0, 0, 0]
    return { bg: '#' + [...b.slice(0, 3)].map(hex2).join(''), fg: '#' + fg.map(hex2).join('') }
  } catch {
    return { bg: '#ffffff', fg: '#000000' }
  }
}

// ── Tablas: celdas por línea y rejilla de columnas ──
export async function pageLines(doc, n) {
  const pg = await doc.getPage(n)
  const tc = await pg.getTextContent()
  const items = tc.items
    .filter((i) => i.str && i.str.trim())
    .map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], h: Math.abs(i.transform[3]) || 10, w: i.width }))
    .sort((a, b) => b.y - a.y || a.x - b.x)
  const lines = []
  for (const it of items) {
    const L = lines[lines.length - 1]
    if (L && Math.abs(it.y - L.y) <= Math.max(2, it.h * 0.4)) L.items.push(it)
    else lines.push({ y: it.y, items: [it] })
  }
  return lines.map((L) => {
    const its = L.items.sort((a, b) => a.x - b.x)
    const cells = []
    for (const it of its) {
      const c = cells[cells.length - 1]
      const gap = c ? it.x - (c.x + c.w) : 0
      if (c && gap < it.h * 1.0) {
        if (gap > it.h * 0.15 && !c.text.endsWith(' ')) c.text += ' '
        c.text += it.s
        c.w = it.x + it.w - c.x
      } else cells.push({ x: it.x, w: it.w, text: it.s })
    }
    return { y: L.y, size: Math.max(...its.map((i) => i.h)), cells: cells.map((c) => ({ ...c, text: c.text.trim() })).filter((c) => c.text) }
  }).filter((l) => l.cells.length)
}

export function toGrid(lines, tol = 10) {
  const xs = lines.flatMap((l) => l.cells.map((c) => c.x)).sort((a, b) => a - b)
  const cols = []
  xs.forEach((x) => {
    if (!cols.length || x - cols[cols.length - 1].max > tol) cols.push({ min: x, max: x })
    else cols[cols.length - 1].max = x
  })
  const colOf = (x) => cols.findIndex((c) => x >= c.min - tol && x <= c.max + tol)
  return lines.map((l) => {
    const row = Array(cols.length).fill('')
    l.cells.forEach((c) => {
      const i = colOf(c.x)
      row[i] = row[i] ? row[i] + ' ' + c.text : c.text
    })
    return row
  })
}
