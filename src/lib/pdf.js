import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Abre un PDF: devuelve bytes (para pdf-lib) y doc (para pdf.js, renderizado y texto). */
export async function loadPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    // pdf.js transfiere el buffer al worker, por eso le pasamos una copia
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
    return { id: uid(), file, name: file.name, size: file.size, bytes, doc, pages: doc.numPages }
  } catch (e) {
    if (e?.name === 'PasswordException') throw new Error(`«${file.name}» está protegido con contraseña. Quítala primero con la herramienta «Desbloquear PDF».`)
    throw new Error(`No se pudo abrir «${file.name}». ¿Es un PDF válido?`)
  }
}

/** Renderiza una página a un canvas nuevo. Usa `width` (px) o `scale`. */
export async function renderPage(doc, n, { scale = 1, width } = {}) {
  const page = await doc.getPage(n)
  const base = page.getViewport({ scale: 1 })
  const vp = page.getViewport({ scale: width ? width / base.width : scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(vp.width))
  canvas.height = Math.max(1, Math.floor(vp.height))
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  return canvas
}

export const canvasToBlob = (c, type = 'image/jpeg', q = 0.85) => new Promise((res) => c.toBlob(res, type, q))
export const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' })
export const baseName = (n) => n.replace(/\.[^.]+$/, '')

export function saveAs(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

export function fmtSize(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 ** 2).toFixed(2)} MB`
}

/** "1-3, 5" → [[0,1,2],[4]] (índices base 0) */
export function parseRanges(str, total) {
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
      if (!m) throw new Error(`Rango no válido: «${part}». Usa el formato 1-3, 5.`)
      let a = +m[1]
      let b = m[2] ? +m[2] : a
      if (a > b) [a, b] = [b, a]
      if (a < 1 || b > total) throw new Error(`El rango «${part}» está fuera del documento (1–${total}).`)
      return Array.from({ length: b - a + 1 }, (_, i) => a - 1 + i)
    })
}

export async function zipBlobs(files) {
  const z = new JSZip()
  files.forEach((f) => z.file(f.name, f.blob))
  return z.generateAsync({ type: 'blob' })
}

/** Sustituye caracteres que la fuente estándar no puede codificar */
export function safeText(font, str) {
  const set = new Set(font.getCharacterSet())
  return [...str].map((ch) => (set.has(ch.codePointAt(0)) ? ch : '?')).join('')
}

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

export async function fileToPngDataUrl(file, maxSide = 1200) {
  const bmp = await createImageBitmap(file)
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * k)
  c.height = Math.round(bmp.height * k)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return { dataUrl: c.toDataURL('image/png'), ratio: c.width / c.height }
}

/** "1-3, 5" → [0,1,2,4] (únicos y ordenados, base 0) */
export const rangeIndices = (str, total) => [...new Set(parseRanges(str, total).flat())].sort((a, b) => a - b)

/** [1,2,3,5] → "1-3, 5" */
export function indicesToRanges(nums) {
  const s = [...nums].sort((a, b) => a - b)
  const out = []
  for (let i = 0; i < s.length; ) {
    let j = i
    while (s[j + 1] === s[j] + 1) j++
    out.push(j > i ? `${s[i]}-${s[j]}` : `${s[i]}`)
    i = j + 1
  }
  return out.join(', ')
}

export function toRoman(n, lower = false) {
  const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  let s = ''
  for (const [v, r] of m) while (n >= v) { s += r; n -= v }
  return lower ? s.toLowerCase() : s
}

export function toLetters(n, upper = false) {
  let s = ''
  while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26) }
  return upper ? s.toUpperCase() : s
}

export const todayStr = () => new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Lee un archivo como PDFDocument de pdf-lib (para herramientas que no necesitan pdf.js). */
export const readBytes = async (file) => new Uint8Array(await file.arrayBuffer())
