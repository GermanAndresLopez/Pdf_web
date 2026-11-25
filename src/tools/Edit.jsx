import { useEffect, useRef, useState } from 'react'
import { LineCapStyle, PDFDocument, rgb } from 'pdf-lib'
import { Button, ErrorNote, Icon, IconButton, Result, Sheet } from '../components/ui'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fileToPngDataUrl, hexToRgb, pdfBlob, renderPage, safeText, todayStr, uid } from '../lib/pdf'
import { CSS_FAM, stdFont } from '../lib/fonts'
import { extractRuns, sampleColors } from '../lib/runs'
import { useTask } from '../lib/hooks'

const COLORS = ['#111111', '#007aff', '#ff3b30', '#34c759', '#ffcc00', '#ffffff']
const ASC = 0.85 // línea base del texto respecto a su borde superior
const LH = 1.2
const SIGS_KEY = 'pdfweb:signatures'

const TOOLS = [
  ['edittext', 'edit', 'Editar texto'],
  ['select', 'cursor', 'Mover'],
  ['text', 'text', 'Añadir'],
  ['date', 'calendar', 'Fecha'],
  ['draw', 'pen', 'Dibujar'],
  ['highlight', 'highlight', 'Resaltar'],
  ['underline', 'underline', 'Subrayar'],
  ['strike', 'strike', 'Tachar'],
  ['box', 'rect', 'Rectángulo'],
  ['ellipse', 'ellipse', 'Elipse'],
  ['line', 'line', 'Línea'],
  ['arrow', 'arrow', 'Flecha'],
  ['erase', 'eraser', 'Borrar zona'],
  ['stamp', 'image', 'Imagen'],
  ['sign', 'signature', 'Firma'],
]
const TIPS = {
  edittext: 'Toca cualquier texto del documento para cambiarlo por otro.',
  select: 'Toca un elemento para seleccionarlo; arrástralo para moverlo o usa los puntos azules para cambiar su tamaño. Doble toque para editar texto.',
  text: 'Toca la página donde quieras escribir.',
  date: 'Toca la página para insertar la fecha de hoy.',
  draw: 'Dibuja con el dedo o el ratón.',
  highlight: 'Arrastra para resaltar una zona.',
  underline: 'Toca una línea de texto para subrayarla.',
  strike: 'Toca una línea de texto para tacharla.',
  box: 'Arrastra para dibujar un rectángulo.',
  ellipse: 'Arrastra para dibujar una elipse.',
  line: 'Arrastra para trazar una línea.',
  arrow: 'Arrastra para trazar una flecha.',
  erase: 'Arrastra sobre lo que quieras tapar (cubre con un recuadro opaco).',
  stamp: 'Toca la página para colocar la imagen.',
}
const RUN_TOOLS = ['edittext', 'underline', 'strike']
const COLOR_TOOLS = ['text', 'date', 'draw', 'highlight', 'underline', 'strike', 'box', 'ellipse', 'line', 'arrow', 'erase']
const isTxt = (a) => a?.type === 'text' || a?.type === 'replace'
const RESIZABLE = ['rect', 'shape', 'image']

function bbox(a) {
  if (a.type === 'replace') {
    const lines = a.text.split('\n')
    return { x: a.x, y: a.y, w: Math.max(a.cover.w, ...lines.map((l) => l.length * a.size * 0.52)), h: lines.length * a.size * LH }
  }
  if (a.type === 'text') {
    const lines = a.text.split('\n')
    return { x: a.x, y: a.y, w: Math.max(...lines.map((l) => l.length)) * a.size * 0.52, h: lines.length * a.size * LH }
  }
  if (a.type === 'draw') {
    const xs = a.points.map((p) => p[0]), ys = a.points.map((p) => p[1])
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
  }
  if (a.type === 'line') return { x: Math.min(a.x1, a.x2), y: Math.min(a.y1, a.y2), w: Math.abs(a.x2 - a.x1), h: Math.abs(a.y2 - a.y1) }
  return { x: a.x, y: a.y, w: a.w, h: a.h }
}

const moveAnn = (a, dx, dy) =>
  a.type === 'draw' ? { ...a, points: a.points.map(([x, y]) => [x + dx, y + dy]) }
    : a.type === 'line' ? { ...a, x1: a.x1 + dx, y1: a.y1 + dy, x2: a.x2 + dx, y2: a.y2 + dy }
      : { ...a, x: a.x + dx, y: a.y + dy }

function resizeAnn(o, handle, p) {
  if (o.type === 'line') return handle === 'p1' ? { ...o, x1: p.x, y1: p.y } : { ...o, x2: p.x, y2: p.y }
  const fx = handle.includes('w') ? o.x + o.w : o.x
  const fy = handle.includes('n') ? o.y + o.h : o.y
  let w = Math.abs(p.x - fx)
  let h = Math.abs(p.y - fy)
  if (o.type === 'image') h = w / (o.w / o.h)
  w = Math.max(6, w); h = Math.max(6, h)
  return { ...o, x: p.x < fx ? fx - w : fx, y: p.y < fy ? fy - h : fy, w, h }
}

/** Puntas de flecha (dos segmentos) para una línea x1,y1 → x2,y2 */
function arrowHead(a) {
  const ang = Math.atan2(a.y2 - a.y1, a.x2 - a.x1)
  const len = Math.max(9, a.width * 4.5)
  return [0.45, -0.45].map((d) => [a.x2, a.y2, a.x2 - len * Math.cos(ang + d), a.y2 - len * Math.sin(ang + d)])
}

const loadSigs = () => { try { return JSON.parse(localStorage.getItem(SIGS_KEY)) || [] } catch { return [] } }

export default function Edit() {
  const input = usePdfInput()
  return (
    <PdfGate input={input} title="Selecciona un PDF para editar">
      {input.pdf && <Editor pdf={input.pdf} onClose={() => input.setPdf(null)} />}
    </PdfGate>
  )
}

function Editor({ pdf, onClose }) {
  const [page, setPage] = useState(1)
  const [tool, setTool] = useState('edittext')
  const [color, setColor] = useState(COLORS[1])
  const [size, setSize] = useState(18)
  const [fam, setFam] = useState('sans')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [anns, setAnns] = useState([])
  const [sel, setSel] = useState(null)
  const [dims, setDims] = useState(null)
  const [runs, setRuns] = useState([])
  const [textDraft, setTextDraft] = useState(null)
  const [sigOpen, setSigOpen] = useState(false)
  const [stamp, setStamp] = useState(null)
  const hist = useRef([])
  const drag = useRef(null)
  const host = useRef()
  const svg = useRef()
  const fileInput = useRef()
  const t = useTask()

  // Render de la página actual y detección de su texto
  useEffect(() => {
    let dead = false
    ;(async () => {
      const pg = await pdf.doc.getPage(page)
      const vp = pg.getViewport({ scale: 1 })
      const c = await renderPage(pdf.doc, page, { scale: 1.6 * Math.min(2, window.devicePixelRatio || 1) })
      if (dead || !host.current) return
      setDims({ w: vp.width, h: vp.height })
      host.current.replaceChildren(c)
      const r = await extractRuns(pg, vp.height).catch(() => [])
      if (!dead) setRuns(r)
    })()
    return () => { dead = true }
  }, [pdf, page])

  const push = () => hist.current.push(anns)
  const undo = () => { const p = hist.current.pop(); if (p) { setAnns(p); setSel(null) } }
  const remove = () => { if (!sel) return; push(); setAnns((a) => a.filter((x) => x.id !== sel)); setSel(null) }
  const duplicate = () => {
    const a = anns.find((x) => x.id === sel)
    if (!a) return
    push()
    const c = { ...moveAnn(a, 14, 14), id: uid() }
    setAnns((s) => [...s, c]); setSel(c.id)
  }
  const pick = (name) => { setTool(name); setSel(null) }

  // Teclado: suprimir y mover con flechas
  useEffect(() => {
    const k = (e) => {
      if (!sel || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove() }
      const d = e.shiftKey ? 10 : 1
      const mv = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]
      if (mv) { e.preventDefault(); setAnns((s) => s.map((a) => (a.id === sel ? moveAnn(a, mv[0], mv[1]) : a))) }
    }
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })

  const toPt = (e) => {
    const r = svg.current.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * dims.w, y: ((e.clientY - r.top) / r.height) * dims.h }
  }
  const base = () => ({ id: uid(), page })

  const startReplace = (r) => {
    const top = r.base - r.size * ASC
    const cover = { x: r.x - 1, y: top - r.size * 0.05, w: r.w + 2, h: r.size * 1.15 }
    const cv = host.current?.firstChild
    const { bg, fg } = cv ? sampleColors(cv, cv.width / dims.w, cover) : { bg: '#ffffff', fg: '#000000' }
    const a = { ...base(), type: 'replace', runId: r.id, x: r.x, y: top, size: r.size, family: r.family, bold: r.bold, italic: r.italic, color: fg, cover: { ...cover, color: bg }, text: r.str }
    push()
    setAnns((s) => [...s, a])
    setSel(a.id)
    setTextDraft({ id: a.id, text: a.text, fresh: true })
  }

  const onDown = (e) => {
    if (!dims) return
    const p = toPt(e)
    const cap = () => svg.current.setPointerCapture(e.pointerId)
    const hit = e.target.closest?.('[data-id]')?.dataset.id
    const hd = e.target.dataset?.handle
    const ri = e.target.dataset?.run
    const stroke = Math.max(1, size / 8)

    if (hd && sel) {
      push(); drag.current = { type: 'resize', id: sel, handle: hd, orig: anns.find((a) => a.id === sel) }; cap(); return
    }
    if (RUN_TOOLS.includes(tool) && ri !== undefined) {
      const r = runs[+ri]
      if (tool === 'edittext') return startReplace(r)
      const y = tool === 'underline' ? r.base + r.size * 0.12 : r.base - r.size * 0.3
      push()
      setAnns((s) => [...s, { ...base(), type: 'line', x1: r.x, y1: y, x2: r.x + r.w, y2: y, color, width: Math.max(0.8, r.size / 14) }])
      return
    }
    if (tool === 'edittext') {
      const a = anns.find((x) => x.id === hit)
      if (isTxt(a)) { setSel(a.id); setTextDraft({ id: a.id, text: a.text }) } else setSel(null)
    } else if (tool === 'select') {
      if (hit) { setSel(hit); push(); drag.current = { type: 'move', id: hit, last: p }; cap() } else setSel(null)
    } else if (tool === 'text') {
      setTextDraft({ x: p.x, y: p.y, text: '' })
    } else if (tool === 'date') {
      push()
      const a = { ...base(), type: 'text', x: p.x, y: p.y - size / 2, text: todayStr(), size, color, family: fam, bold, italic }
      setAnns((s) => [...s, a]); setSel(a.id); setTool('select')
    } else if (tool === 'highlight' || tool === 'erase') {
      const a = { ...base(), type: 'rect', x: p.x, y: p.y, w: 0, h: 0, color: tool === 'erase' ? (color === COLORS[1] ? '#ffffff' : color) : color, op: tool === 'erase' ? 1 : 0.35 }
      push(); setAnns((s) => [...s, a]); drag.current = { type: 'rect', id: a.id, start: p }; cap()
    } else if (tool === 'box' || tool === 'ellipse') {
      const a = { ...base(), type: 'shape', kind: tool === 'box' ? 'rect' : 'ellipse', x: p.x, y: p.y, w: 0, h: 0, color, width: stroke }
      push(); setAnns((s) => [...s, a]); drag.current = { type: 'rect', id: a.id, start: p, select: true }; cap()
    } else if (tool === 'line' || tool === 'arrow') {
      const a = { ...base(), type: 'line', x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, width: stroke, arrow: tool === 'arrow' }
      push(); setAnns((s) => [...s, a]); drag.current = { type: 'line', id: a.id, select: true }; cap()
    } else if (tool === 'draw') {
      const a = { ...base(), type: 'draw', color, width: Math.max(1.5, size / 6), points: [[p.x, p.y]] }
      push(); setAnns((s) => [...s, a]); drag.current = { type: 'draw', id: a.id }; cap()
    } else if (tool === 'stamp' && stamp) {
      const w = Math.min(180, dims.w * 0.4)
      const h = w / stamp.ratio
      const a = { ...base(), type: 'image', x: p.x - w / 2, y: p.y - h / 2, w, h, dataUrl: stamp.dataUrl }
      push(); setAnns((s) => [...s, a]); setTool('select'); setSel(a.id)
    }
  }

  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const p = toPt(e)
    const upd = (fn) => setAnns((s) => s.map((a) => (a.id === d.id ? fn(a) : a)))
    if (d.type === 'move') { const dx = p.x - d.last.x, dy = p.y - d.last.y; d.last = p; upd((a) => moveAnn(a, dx, dy)) }
    else if (d.type === 'resize') upd(() => resizeAnn(d.orig, d.handle, p))
    else if (d.type === 'rect') upd((a) => ({ ...a, x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) }))
    else if (d.type === 'line') upd((a) => ({ ...a, x2: p.x, y2: p.y }))
    else if (d.type === 'draw') upd((a) => ({ ...a, points: [...a.points, [p.x, p.y]] }))
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.type === 'rect') setAnns((s) => s.filter((a) => !(a.id === d.id && (a.w < 2 || a.h < 2))))
    if (d.type === 'line') setAnns((s) => s.filter((a) => !(a.id === d.id && Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 3)))
    if (d.select) { setSel(d.id) }
    if (d.select) setTool('select')
  }

  const cancelDraft = () => {
    if (textDraft?.fresh) { hist.current.pop(); setAnns((s) => s.filter((a) => a.id !== textDraft.id)); setSel(null) }
    setTextDraft(null)
  }

  const addText = () => {
    const d = textDraft
    if (d?.id) {
      if (!d.fresh) push()
      setAnns((s) => s.map((a) => (a.id === d.id ? { ...a, text: d.text } : a)))
      setTextDraft(null)
      return
    }
    if (!d?.text.trim()) return setTextDraft(null)
    push()
    const a = { ...base(), type: 'text', x: d.x, y: d.y, text: d.text, size, color, family: fam, bold, italic }
    setAnns((s) => [...s, a]); setTextDraft(null); setTool('select'); setSel(a.id)
  }

  const onImage = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try { setStamp(await fileToPngDataUrl(f)); pick('stamp') } catch { t.setError('No se pudo leer la imagen.') }
  }

  const patch = (changes) => setAnns((s) => s.map((a) => (a.id === sel ? { ...a, ...changes } : a)))
  const selAnn = anns.find((a) => a.id === sel)

  const save = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const fonts = {}
      const getFont = async (a) => (fonts[stdFont(a)] ||= await doc.embedFont(stdFont(a)))
      const pages = doc.getPages()
      const imgs = {}
      for (const a of anns) {
        const pg = pages[a.page - 1]
        const H = pg.getSize().height
        const c = hexToRgb(a.color || '#000000')
        const col = rgb(c.r, c.g, c.b)
        if (a.type === 'rect') {
          pg.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, color: col, opacity: a.op ?? 0.35 })
        } else if (a.type === 'shape') {
          if (a.kind === 'rect') pg.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, borderColor: col, borderWidth: a.width })
          else pg.drawEllipse({ x: a.x + a.w / 2, y: H - a.y - a.h / 2, xScale: a.w / 2, yScale: a.h / 2, borderColor: col, borderWidth: a.width })
        } else if (a.type === 'line') {
          const seg = (x1, y1, x2, y2) => pg.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness: a.width, color: col, lineCap: LineCapStyle.Round })
          seg(a.x1, a.y1, a.x2, a.y2)
          if (a.arrow) arrowHead(a).forEach((s) => seg(...s))
        } else if (a.type === 'text' || a.type === 'replace') {
          if (a.type === 'replace') {
            const bg = hexToRgb(a.cover.color)
            pg.drawRectangle({ x: a.cover.x, y: H - a.cover.y - a.cover.h, width: a.cover.w, height: a.cover.h, color: rgb(bg.r, bg.g, bg.b) })
          }
          const font = await getFont(a)
          a.text.split('\n').forEach((line, i) => pg.drawText(safeText(font, line), { x: a.x, y: H - (a.y + a.size * ASC + i * a.size * LH), size: a.size, font, color: col }))
        } else if (a.type === 'draw') {
          const pts = a.points.length === 1 ? [a.points[0], [a.points[0][0] + 0.1, a.points[0][1]]] : a.points
          for (let i = 1; i < pts.length; i++) pg.drawLine({ start: { x: pts[i - 1][0], y: H - pts[i - 1][1] }, end: { x: pts[i][0], y: H - pts[i][1] }, thickness: a.width, color: col, lineCap: LineCapStyle.Round })
        } else if (a.type === 'image') {
          imgs[a.dataUrl] ||= await doc.embedPng(a.dataUrl)
          pg.drawImage(imgs[a.dataUrl], { x: a.x, y: H - a.y - a.h, width: a.w, height: a.h })
        }
      }
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_editado.pdf`, info: `${anns.length} ${anns.length === 1 ? 'cambio aplicado' : 'cambios aplicados'}` }
    })

  if (t.result) return <Result result={t.result} onReset={t.reset} resetLabel="Seguir editando" />

  const here = anns.filter((a) => a.page === page)
  const replaced = new Set(here.filter((a) => a.type === 'replace').map((a) => a.runId))
  const textish = tool === 'text' || tool === 'date' || isTxt(selAnn)
  const showColor = COLOR_TOOLS.includes(tool) || (selAnn && selAnn.type !== 'image')
  const colorVal = selAnn?.color || color
  const sizeVal = isTxt(selAnn) ? Math.round(selAnn.size) : selAnn?.width ? Math.round(selAnn.width * 8) : size
  const fontVal = isTxt(selAnn) ? { family: selAnn.family || 'sans', bold: !!selAnn.bold, italic: !!selAnn.italic } : { family: fam, bold, italic }
  const setFont = (k, v) => { if (isTxt(selAnn)) patch({ [k]: v }); else ({ family: setFam, bold: setBold, italic: setItalic })[k](v) }
  const setColorAll = (c) => { setColor(c); if (selAnn && selAnn.type !== 'image') { push(); patch({ color: c }) } }

  return (
    <div className="page-wrap">
      <div className="editor-top">
        <div className="pager">
          <IconButton icon="left" label="Página anterior" disabled={page === 1} onClick={() => { setPage(page - 1); setSel(null) }} />
          <span>Página {page} de {pdf.pages}</span>
          <IconButton icon="right" label="Página siguiente" disabled={page === pdf.pages} onClick={() => { setPage(page + 1); setSel(null) }} />
        </div>
        <span className="spacer" />
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)' }}>
          <Icon name="zoom" size={18} />
          <input type="range" min="60" max="220" step="10" value={zoom} onChange={(e) => setZoom(+e.target.value)} aria-label="Zoom" style={{ width: 90, accentColor: 'var(--blue)' }} />
        </span>
        <IconButton icon="undo" label="Deshacer" disabled={!hist.current.length} onClick={undo} />
        <Button variant="gray" className="small" onClick={onClose}>Cambiar archivo</Button>
        <Button className="small" icon="download" busy={t.busy} disabled={!anns.length} onClick={save}>Guardar PDF</Button>
      </div>
      <ErrorNote msg={t.error} />

      <div style={{ overflowX: zoom > 100 ? 'auto' : 'visible', marginTop: 12, paddingBottom: 4 }}>
        <div className="pdf-page" style={{ aspectRatio: dims ? `${dims.w} / ${dims.h}` : '1 / 1.414', width: `${zoom}%`, margin: zoom < 100 ? '0 auto' : 0 }}>
          <div ref={host} />
          {dims && (
            <svg
              ref={svg}
              viewBox={`0 0 ${dims.w} ${dims.h}`}
              style={{ touchAction: tool === 'select' || RUN_TOOLS.includes(tool) ? 'pan-y' : 'none', cursor: tool === 'select' ? 'default' : tool === 'text' || RUN_TOOLS.includes(tool) ? 'text' : 'crosshair' }}
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              onDoubleClick={(e) => {
                const a = anns.find((x) => x.id === e.target.closest?.('[data-id]')?.dataset.id)
                if (isTxt(a)) setTextDraft({ id: a.id, text: a.text })
              }}
            >
              {RUN_TOOLS.includes(tool) && runs.filter((r) => tool !== 'edittext' || !replaced.has(r.id)).map((r) => (
                <rect key={r.id} className="run" data-run={r.id} x={r.x - 1} y={r.base - r.size * 0.95} width={r.w + 2} height={r.size * 1.2} />
              ))}
              {here.map((a) => {
                if (a.type === 'rect') return <rect key={a.id} data-id={a.id} x={a.x} y={a.y} width={a.w} height={a.h} fill={a.color} fillOpacity={a.op ?? 0.35} />
                if (a.type === 'shape') return a.kind === 'rect'
                  ? <rect key={a.id} data-id={a.id} x={a.x} y={a.y} width={a.w} height={a.h} fill="transparent" stroke={a.color} strokeWidth={a.width} pointerEvents="stroke" />
                  : <ellipse key={a.id} data-id={a.id} cx={a.x + a.w / 2} cy={a.y + a.h / 2} rx={a.w / 2} ry={a.h / 2} fill="transparent" stroke={a.color} strokeWidth={a.width} pointerEvents="stroke" />
                if (a.type === 'line') return (
                  <g key={a.id} data-id={a.id} stroke={a.color} strokeWidth={a.width} strokeLinecap="round" fill="none">
                    <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} />
                    {a.arrow && arrowHead(a).map((s, i) => <line key={i} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} />)}
                    <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="transparent" strokeWidth={Math.max(10, a.width + 8)} pointerEvents="stroke" />
                  </g>
                )
                if (a.type === 'draw') return <polyline key={a.id} data-id={a.id} points={a.points.map((p) => p.join(',')).join(' ')} fill="none" stroke={a.color} strokeWidth={a.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="stroke" />
                if (a.type === 'image') return <image key={a.id} data-id={a.id} href={a.dataUrl} x={a.x} y={a.y} width={a.w} height={a.h} preserveAspectRatio="none" />
                const lines = a.text.split('\n')
                const txt = (
                  <text fontSize={a.size} fill={a.color} fontFamily={CSS_FAM[a.family || 'sans']} fontWeight={a.bold ? 700 : 400} fontStyle={a.italic ? 'italic' : 'normal'}>
                    {lines.map((l, i) => <tspan key={i} x={a.x} y={a.y + a.size * ASC + i * a.size * LH}>{l || ' '}</tspan>)}
                  </text>
                )
                return a.type === 'replace'
                  ? <g key={a.id} data-id={a.id}><rect x={a.cover.x} y={a.cover.y} width={a.cover.w} height={a.cover.h} fill={a.cover.color} />{txt}</g>
                  : <g key={a.id} data-id={a.id}>{txt}</g>
              })}
              {selAnn && selAnn.page === page && (() => {
                const b = bbox(selAnn)
                const hs = selAnn.type === 'line' ? [['p1', selAnn.x1, selAnn.y1], ['p2', selAnn.x2, selAnn.y2]] : RESIZABLE.includes(selAnn.type) ? [['nw', b.x, b.y], ['ne', b.x + b.w, b.y], ['sw', b.x, b.y + b.h], ['se', b.x + b.w, b.y + b.h]] : []
                return (
                  <g>
                    <rect x={b.x - 3} y={b.y - 3} width={b.w + 6} height={b.h + 6} fill="none" stroke="#007aff" strokeWidth="1.2" strokeDasharray="4 3" pointerEvents="none" />
                    {hs.map(([h, x, y]) => <circle key={h} data-handle={h} cx={x} cy={y} r="6" fill="#fff" stroke="#007aff" strokeWidth="2" style={{ cursor: 'nwse-resize' }} />)}
                  </g>
                )
              })()}
            </svg>
          )}
        </div>
      </div>
      <p className="tip">{TIPS[tool]}</p>

      <div className="toolbar-wrap">
        {(showColor || selAnn) && (
          <div className="subbar">
            {showColor && (
              <>
                {COLORS.map((c) => <button key={c} className="swatch" style={{ background: c }} aria-label={`Color ${c}`} aria-pressed={colorVal.toLowerCase() === c} onClick={() => setColorAll(c)} />)}
                <input type="color" value={colorVal.length === 7 ? colorVal : '#000000'} onChange={(e) => setColorAll(e.target.value)} aria-label="Otro color" style={{ width: 30, height: 30, border: 0, padding: 0, background: 'none', flex: 'none' }} />
                <span className="sep-v" />
                <span className="lbl">{textish ? 'Tamaño' : 'Grosor'}</span>
                <input
                  type="range" min={textish ? 6 : 1} max={textish ? 72 : 48} value={sizeVal} aria-label="Tamaño"
                  onChange={(e) => {
                    const v = +e.target.value
                    if (isTxt(selAnn)) patch({ size: v })
                    else if (selAnn?.width) patch({ width: Math.max(0.5, v / 8) })
                    else setSize(v)
                  }}
                />
              </>
            )}
            {textish && (
              <>
                <span className="sep-v" />
                {['sans', 'serif', 'mono'].map((f) => <button key={f} className={`tool-btn ${fontVal.family === f ? 'active' : ''}`} style={{ padding: '6px 10px', fontFamily: CSS_FAM[f] }} onClick={() => setFont('family', f)}>{f === 'sans' ? 'Aa' : f === 'serif' ? 'Aa' : 'Aa'}<span style={{ fontSize: 10 }}>{f === 'sans' ? 'Sans' : f === 'serif' ? 'Serif' : 'Mono'}</span></button>)}
                <button className={`tool-btn ${fontVal.bold ? 'active' : ''}`} style={{ padding: '6px 12px', fontWeight: 800, fontSize: 16 }} aria-label="Negrita" onClick={() => setFont('bold', !fontVal.bold)}>B</button>
                <button className={`tool-btn ${fontVal.italic ? 'active' : ''}`} style={{ padding: '6px 12px', fontStyle: 'italic', fontSize: 16 }} aria-label="Cursiva" onClick={() => setFont('italic', !fontVal.italic)}>I</button>
              </>
            )}
            {selAnn && (
              <>
                <span className="sep-v" />
                {isTxt(selAnn) && <Button variant="tinted" className="small" icon="edit" onClick={() => setTextDraft({ id: selAnn.id, text: selAnn.text })}>Editar</Button>}
                <Button variant="gray" className="small" icon="copy" onClick={duplicate}>Duplicar</Button>
                <Button variant="danger" className="small" icon="trash" onClick={remove}>Eliminar</Button>
              </>
            )}
          </div>
        )}
        <div className="toolbar" role="toolbar" aria-label="Herramientas de edición">
          {TOOLS.map(([id, icon, label]) => (
            <button
              key={id}
              className={`tool-btn ${tool === id ? 'active' : ''}`}
              aria-pressed={tool === id}
              onClick={() => (id === 'stamp' ? fileInput.current.click() : id === 'sign' ? setSigOpen(true) : pick(id))}
            >
              <Icon name={icon} size={22} />
              {label}
            </button>
          ))}
        </div>
      </div>
      <input ref={fileInput} type="file" accept="image/*" hidden onChange={onImage} />

      <Sheet
        open={!!textDraft}
        title={textDraft?.id ? 'Editar texto' : 'Añadir texto'}
        onClose={cancelDraft}
        footer={<Button disabled={!textDraft?.id && !textDraft?.text.trim()} onClick={addText}>{textDraft?.id ? 'Aplicar' : 'Añadir'}</Button>}
      >
        <textarea className="big" autoFocus placeholder="Escribe aquí…" value={textDraft?.text || ''} onChange={(e) => setTextDraft((d) => ({ ...d, text: e.target.value }))} />
        {textDraft?.fresh && <p className="hint" style={{ marginTop: 10 }}>Déjalo vacío para borrar este texto del documento.</p>}
      </Sheet>

      {sigOpen && <SignatureSheet onClose={() => setSigOpen(false)} onDone={(dataUrl) => { setStamp({ dataUrl, ratio: 3 }); setSigOpen(false); pick('stamp') }} />}
    </div>
  )
}

function SignatureSheet({ onClose, onDone }) {
  const ref = useRef()
  const drawing = useRef(false)
  const [empty, setEmpty] = useState(true)
  const [saved, setSaved] = useState(loadSigs)

  const store = (list) => { setSaved(list); try { localStorage.setItem(SIGS_KEY, JSON.stringify(list)) } catch { /* sin espacio */ } }
  const pos = (e) => {
    const r = ref.current.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * ref.current.width, ((e.clientY - r.top) / r.height) * ref.current.height]
  }
  const down = (e) => {
    drawing.current = true
    ref.current.setPointerCapture(e.pointerId)
    const ctx = ref.current.getContext('2d')
    const [x, y] = pos(e)
    ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0a1a4a'
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y); ctx.stroke()
    setEmpty(false)
  }
  const move = (e) => {
    if (!drawing.current) return
    const [x, y] = pos(e)
    const ctx = ref.current.getContext('2d')
    ctx.lineTo(x, y); ctx.stroke()
  }
  const clear = () => { ref.current.getContext('2d').clearRect(0, 0, 900, 300); setEmpty(true) }
  const use = () => {
    const url = ref.current.toDataURL('image/png')
    store([url, ...saved.filter((s) => s !== url)].slice(0, 4))
    onDone(url)
  }

  return (
    <Sheet open title="Tu firma" onClose={onClose} footer={<><Button variant="gray" onClick={clear}>Borrar</Button><Button disabled={empty} onClick={use}>Usar firma</Button></>}>
      {saved.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="section-label" style={{ marginTop: 0 }}>Firmas guardadas</p>
          <div className="toolrow">
            {saved.map((s) => (
              <span key={s} style={{ position: 'relative' }}>
                <button onClick={() => onDone(s)} style={{ background: '#fff', borderRadius: 10, padding: 4, boxShadow: '0 0 0 0.5px var(--sep)' }}><img src={s} alt="Firma guardada" style={{ height: 44, display: 'block' }} /></button>
                <button className="icon-btn" aria-label="Eliminar firma guardada" style={{ position: 'absolute', top: -8, right: -8, width: 22, height: 22 }} onClick={() => store(saved.filter((x) => x !== s))}><Icon name="close" size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      )}
      <canvas ref={ref} className="sigpad" width="900" height="300" onPointerDown={down} onPointerMove={move} onPointerUp={() => (drawing.current = false)} onPointerCancel={() => (drawing.current = false)} />
      <p className="hint" style={{ marginTop: 10 }}>Dibuja tu firma con el dedo o el ratón. Se guarda en este navegador para reutilizarla.</p>
    </Sheet>
  )
}
