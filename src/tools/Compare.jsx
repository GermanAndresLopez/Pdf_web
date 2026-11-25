import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dropzone, ErrorNote, Group, Pager, Segmented } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { loadPdf, renderPage, saveAs } from '../lib/pdf'
import { pageLines } from '../lib/runs'
import { useTask } from '../lib/hooks'

function CanvasView({ canvas }) {
  const ref = useRef()
  useEffect(() => { if (canvas && ref.current) ref.current.replaceChildren(canvas) }, [canvas])
  return <div ref={ref} />
}

const blank = (w, h) => {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const x = c.getContext('2d')
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
  return c
}

function fit(src, w, h) {
  const c = blank(w, h)
  if (src) c.getContext('2d').drawImage(src, 0, 0)
  return c
}

async function docLines(pdf) {
  const out = []
  for (let n = 1; n <= pdf.pages; n++) (await pageLines(pdf.doc, n)).forEach((l) => out.push(l.cells.map((c) => c.text).join(' ')))
  return out
}

/** Diferencia por líneas (LCS). */
function diffLines(a, b) {
  const n = a.length, m = b.length
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const out = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: 'same', s: a[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ t: 'del', s: a[i++] })
    else out.push({ t: 'add', s: b[j++] })
  }
  while (i < n) out.push({ t: 'del', s: a[i++] })
  while (j < m) out.push({ t: 'add', s: b[j++] })
  return out
}

export default function Compare() {
  const [a, setA] = useState(null)
  const [b, setB] = useState(null)
  const [tab, setTab] = useState('visual')
  const [page, setPage] = useState(1)
  const [sens, setSens] = useState(40)
  const [view, setView] = useState({ ca: null, cb: null, cd: null, pct: 0 })
  const [lines, setLines] = useState(null)
  const t = useTask()

  const load = (set) => (f) => t.run(async () => set(await loadPdf(f[0])))
  const total = a && b ? Math.max(a.pages, b.pages) : 1

  useEffect(() => {
    if (!a || !b || tab !== 'visual') return
    let dead = false
    ;(async () => {
      const W = 640
      const ra = page <= a.pages ? await renderPage(a.doc, page, { width: W }) : null
      const rb = page <= b.pages ? await renderPage(b.doc, page, { width: W }) : null
      const w = Math.max(ra?.width || 0, rb?.width || 0), h = Math.max(ra?.height || 0, rb?.height || 0)
      const ca = fit(ra, w, h), cb = fit(rb, w, h), cd = blank(w, h)
      const da = ca.getContext('2d').getImageData(0, 0, w, h), db = cb.getContext('2d').getImageData(0, 0, w, h)
      const out = cd.getContext('2d').createImageData(w, h)
      const thr = (101 - sens) * 3
      let diff = 0
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2])
        if (d > thr) { out.data[i] = 255; out.data[i + 1] = 59; out.data[i + 2] = 48; out.data[i + 3] = 255; diff++ }
        else { const g = (da.data[i] + da.data[i + 1] + da.data[i + 2]) / 3; const v = 255 - (255 - g) * 0.35; out.data[i] = out.data[i + 1] = out.data[i + 2] = v; out.data[i + 3] = 255 }
      }
      cd.getContext('2d').putImageData(out, 0, 0)
      if (!dead) setView({ ca, cb, cd, pct: (diff / (w * h)) * 100 })
    })()
    return () => { dead = true }
  }, [a, b, tab, page, sens])

  useEffect(() => {
    if (!a || !b || tab !== 'text' || lines) return
    t.run(async () => {
      const [x, y] = await Promise.all([docLines(a), docLines(b)])
      const MAX = 3000
      const trimmed = x.length > MAX || y.length > MAX
      setLines({ rows: diffLines(x.slice(0, MAX), y.slice(0, MAX)), trimmed })
    })
  }, [a, b, tab]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    if (!lines) return []
    const out = []
    let run = 0
    lines.rows.forEach((r, i) => {
      if (r.t === 'same') {
        const near = lines.rows.slice(Math.max(0, i - 2), i + 3).some((x) => x.t !== 'same')
        if (near) { if (run) out.push({ t: 'skip', s: `… ${run} líneas iguales …` }); run = 0; out.push(r) } else run++
      } else { if (run) out.push({ t: 'skip', s: `… ${run} líneas iguales …` }); run = 0; out.push(r) }
    })
    if (run) out.push({ t: 'skip', s: `… ${run} líneas iguales …` })
    return out
  }, [lines])
  const adds = lines?.rows.filter((r) => r.t === 'add').length || 0
  const dels = lines?.rows.filter((r) => r.t === 'del').length || 0

  return (
    <div className="stack">
      <div className="cmp-grid">
        <div className="stack">
          <p className="section-label" style={{ margin: 0 }}>Documento original</p>
          {a ? <FileCard pdf={a} onRemove={() => { setA(null); setLines(null) }} /> : <Dropzone accept=".pdf,application/pdf" busy={t.busy} title="PDF original" onFiles={load(setA)} />}
        </div>
        <div className="stack">
          <p className="section-label" style={{ margin: 0 }}>Documento modificado</p>
          {b ? <FileCard pdf={b} onRemove={() => { setB(null); setLines(null) }} /> : <Dropzone accept=".pdf,application/pdf" busy={t.busy} title="PDF nuevo" onFiles={load(setB)} />}
        </div>
      </div>
      <ErrorNote msg={t.error} />
      {a && b && (
        <>
          <Segmented value={tab} onChange={setTab} options={[{ value: 'visual', label: 'Diferencias visuales' }, { value: 'text', label: 'Diferencias de texto' }]} />
          {tab === 'visual' ? (
            <>
              <div className="toolrow" style={{ justifyContent: 'space-between' }}>
                <Pager page={page} total={total} onChange={setPage} />
                <div className="group" style={{ minWidth: 260 }}>
                  <label className="field"><span>Sensibilidad</span><input type="range" min="1" max="99" value={sens} onChange={(e) => setSens(+e.target.value)} /></label>
                </div>
              </div>
              <p className="hint">{view.pct < 0.01 ? 'Esta página es idéntica en ambos documentos.' : `${view.pct.toFixed(2)}% de la página es diferente.`}{page > Math.min(a.pages, b.pages) ? ' (Esta página solo existe en uno de los documentos.)' : ''}</p>
              <div className="cmp-grid">
                <figure><figcaption>Original</figcaption><CanvasView canvas={view.ca} /></figure>
                <figure><figcaption>Modificado</figcaption><CanvasView canvas={view.cb} /></figure>
                <figure><figcaption>Diferencias en rojo</figcaption><CanvasView canvas={view.cd} /></figure>
              </div>
              <Button variant="gray" icon="download" onClick={() => view.cd?.toBlob((bl) => saveAs(bl, `diferencias_pagina_${page}.png`))}>Descargar imagen de diferencias</Button>
            </>
          ) : lines ? (
            <>
              <Group><div className="field"><span>Resumen</span><span className="field-val">+{adds} añadidas · −{dels} eliminadas</span></div></Group>
              {lines.trimmed && <div className="note">Los documentos son muy largos: se compararon las primeras 3000 líneas de cada uno.</div>}
              <div className="diff">
                {rows.length ? rows.map((r, i) => <div key={i} className={r.t === 'skip' ? 'hint' : r.t}>{r.t === 'add' ? '+ ' : r.t === 'del' ? '− ' : ''}{r.s}</div>) : 'No hay texto que comparar.'}
              </div>
            </>
          ) : <p className="hint">Analizando texto…</p>}
        </>
      )}
    </div>
  )
}
