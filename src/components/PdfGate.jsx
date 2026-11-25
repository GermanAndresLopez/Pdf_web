import { useEffect, useRef, useState } from 'react'
import { Button, Dropzone, ErrorNote, Icon } from './ui'
import PdfThumb from './PdfThumb'
import { indicesToRanges, loadPdf, parseRanges, renderPage } from '../lib/pdf'
import { useTask } from '../lib/hooks'

/** Estado común de las herramientas que trabajan con un solo PDF. */
export function usePdfInput() {
  const [pdf, setPdf] = useState(null)
  const t = useTask()
  const open = (f) => t.run(async () => setPdf(await loadPdf(f[0])))
  return { pdf, setPdf, t, open }
}

/** Muestra el selector de archivo hasta que haya un PDF cargado. */
export function PdfGate({ input, title = 'Selecciona un PDF', children }) {
  const { pdf, t, open } = input
  if (pdf) return children
  return (
    <div className="stack narrow">
      <Dropzone accept=".pdf,application/pdf" busy={t.busy} title={title} onFiles={open} />
      <ErrorNote msg={t.error} />
    </div>
  )
}

/** Cuadrícula de miniaturas con selección múltiple y atajos (todas, pares, impares, invertir, rangos). */
export function PageSelector({ pdf, selected, onChange }) {
  const [txt, setTxt] = useState('')
  const [err, setErr] = useState('')
  const all = Array.from({ length: pdf.pages }, (_, i) => i + 1)
  const toggle = (n) => {
    const s = new Set(selected)
    s.has(n) ? s.delete(n) : s.add(n)
    onChange(s)
  }
  const applyRange = () => {
    try {
      setErr('')
      const idx = parseRanges(txt, pdf.pages).flat().map((i) => i + 1)
      onChange(new Set([...selected, ...idx]))
      setTxt('')
    } catch (e) {
      setErr(e.message)
    }
  }
  return (
    <div className="stack">
      <div className="toolrow">
        <Button variant="gray" className="small" onClick={() => onChange(new Set(all))}>Todas</Button>
        <Button variant="gray" className="small" onClick={() => onChange(new Set())}>Ninguna</Button>
        <Button variant="gray" className="small" onClick={() => onChange(new Set(all.filter((n) => n % 2 === 1)))}>Impares</Button>
        <Button variant="gray" className="small" onClick={() => onChange(new Set(all.filter((n) => n % 2 === 0)))}>Pares</Button>
        <Button variant="gray" className="small" onClick={() => onChange(new Set(all.filter((n) => !selected.has(n))))}>Invertir</Button>
        <span className="spacer" />
        <span className="hint">{selected.size ? `${selected.size} seleccionadas: ${indicesToRanges(selected)}` : 'Toca las páginas para seleccionarlas'}</span>
      </div>
      <div className="toolrow">
        <div className="group" style={{ flex: 1, minWidth: 220 }}>
          <label className="field">
            <span>Añadir rango</span>
            <input type="text" placeholder="1-3, 7" value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyRange()} />
          </label>
        </div>
        <Button variant="tinted" className="small" disabled={!txt.trim()} onClick={applyRange}>Seleccionar</Button>
      </div>
      {err && <div className="error">{err}</div>}
      <div className="pages">
        {all.map((n) => (
          <button key={n} className={`page-card sel ${selected.has(n) ? 'on' : ''}`} onClick={() => toggle(n)} aria-pressed={selected.has(n)}>
            <div className="thumb-box"><PdfThumb doc={pdf.doc} page={n} width={150} /></div>
            <footer>
              <span>{n}</span>
              {selected.has(n) && <span className="badge"><Icon name="check" size={13} stroke={3} /></span>}
            </footer>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Visor de una página con capa SVG en puntos PDF (origen arriba-izquierda).
 * draw=true permite arrastrar rectángulos (onRect). children puede ser una función (dims) => <svg/>.
 */
export function PageView({ doc, page, scale = 1.4, draw = false, onRect, children, onReady }) {
  const host = useRef()
  const svg = useRef()
  const start = useRef(null)
  const [dims, setDims] = useState(null)
  const [band, setBand] = useState(null)

  useEffect(() => {
    let dead = false
    ;(async () => {
      const pg = await doc.getPage(page)
      const vp = pg.getViewport({ scale: 1 })
      const c = await renderPage(doc, page, { scale: scale * Math.min(2, window.devicePixelRatio || 1) })
      if (dead || !host.current) return
      host.current.replaceChildren(c)
      c.style.width = '100%'
      c.style.height = 'auto'
      c.style.display = 'block'
      setDims({ w: vp.width, h: vp.height })
      onReady?.({ w: vp.width, h: vp.height, canvas: c })
    })()
    return () => { dead = true }
  }, [doc, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const toPt = (e) => {
    const r = svg.current.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * dims.w, y: ((e.clientY - r.top) / r.height) * dims.h }
  }
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) })

  return (
    <div className="pdf-page" style={{ aspectRatio: dims ? `${dims.w} / ${dims.h}` : '1 / 1.414' }}>
      <div ref={host} />
      {dims && (
        <svg
          ref={svg}
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          style={{ touchAction: draw ? 'none' : 'pan-y', cursor: draw ? 'crosshair' : 'default' }}
          onPointerDown={(e) => {
            if (!draw || e.target !== svg.current) return
            start.current = toPt(e)
            svg.current.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => start.current && setBand(rectOf(start.current, toPt(e)))}
          onPointerUp={(e) => {
            if (!start.current) return
            const r = rectOf(start.current, toPt(e))
            start.current = null
            setBand(null)
            if (r.w > 3 && r.h > 3) onRect?.(r)
          }}
        >
          {typeof children === 'function' ? children(dims) : children}
          {band && <rect {...band} fill="rgba(0,122,255,.2)" stroke="#007aff" strokeWidth="1" strokeDasharray="4 3" pointerEvents="none" />}
        </svg>
      )}
    </div>
  )
}
