import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Pager, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PageView, PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob, rangeIndices, renderPage } from '../lib/pdf'

/** Márgenes vistos en pantalla → márgenes en el sistema del PDF sin girar. */
const unrotate = (m, rot) => {
  if (rot === 90) return { l: m.t, t: m.r, r: m.b, b: m.l }
  if (rot === 180) return { l: m.r, t: m.b, r: m.l, b: m.t }
  if (rot === 270) return { l: m.b, t: m.l, r: m.t, b: m.r }
  return m
}

async function detectMargins(doc, n, pad) {
  const scale = 0.8
  const c = await renderPage(doc, n, { scale })
  const ctx = c.getContext('2d', { willReadFrequently: true })
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height)
  let x0 = width, y0 = height, x1 = -1, y1 = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] > 0 && (data[i] < 242 || data[i + 1] < 242 || data[i + 2] < 242)) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }
  if (x1 < 0) return { l: 0, t: 0, r: 0, b: 0 } // página en blanco
  return { l: Math.max(0, x0 / scale - pad), t: Math.max(0, y0 / scale - pad), r: Math.max(0, (width - 1 - x1) / scale - pad), b: Math.max(0, (height - 1 - y1) / scale - pad) }
}

export default function Crop() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('manual')
  const [m, setM] = useState({ t: 5, b: 5, l: 5, r: 5 })
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [pad, setPad] = useState(10)
  const [unify, setUnify] = useState(true)
  const [prev, setPrev] = useState(1)
  const [link, setLink] = useState(true)

  const slide = (k) => (e) => {
    const v = +e.target.value
    setM((o) => (link ? { t: v, b: v, l: v, r: v } : { ...o, [k]: v }))
  }

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const pages = doc.getPages()
      const target = new Set(scope === 'all' ? pages.map((_, i) => i) : scope === 'odd' ? pages.map((_, i) => i).filter((i) => i % 2 === 0) : scope === 'even' ? pages.map((_, i) => i).filter((i) => i % 2 === 1) : rangeIndices(range, pages.length))
      if (!target.size) throw new Error('No hay páginas seleccionadas para recortar.')
      let auto = {}
      if (mode === 'auto') {
        for (const i of target) auto[i] = await detectMargins(pdf.doc, i + 1, pad)
        if (unify) {
          const vals = Object.values(auto)
          const u = { l: Math.min(...vals.map((v) => v.l)), t: Math.min(...vals.map((v) => v.t)), r: Math.min(...vals.map((v) => v.r)), b: Math.min(...vals.map((v) => v.b)) }
          auto = Object.fromEntries([...target].map((i) => [i, u]))
        }
      }
      for (const i of target) {
        const p = pages[i]
        const rot = ((p.getRotation().angle % 360) + 360) % 360
        const box = p.getCropBox()
        const dw = rot % 180 ? box.height : box.width
        const dh = rot % 180 ? box.width : box.height
        const disp = mode === 'auto' ? auto[i] : { l: (m.l / 100) * dw, r: (m.r / 100) * dw, t: (m.t / 100) * dh, b: (m.b / 100) * dh }
        const u = unrotate(disp, rot)
        const nb = { x: box.x + u.l, y: box.y + u.b, width: box.width - u.l - u.r, height: box.height - u.t - u.b }
        if (nb.width < 10 || nb.height < 10) throw new Error(`Los márgenes son demasiado grandes en la página ${i + 1}.`)
        p.setCropBox(nb.x, nb.y, nb.width, nb.height)
        p.setMediaBox(nb.x, nb.y, nb.width, nb.height)
      }
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_recortado.pdf`, info: `${target.size} ${target.size === 1 ? 'página recortada' : 'páginas recortadas'}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack">
          <div className="narrow stack" style={{ width: '100%' }}>
            <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
            <Segmented value={mode} onChange={setMode} options={[{ value: 'manual', label: 'Márgenes manuales' }, { value: 'auto', label: 'Automático (quitar blancos)' }]} />
            {mode === 'manual' ? (
              <Group>
                <div className="field"><span>Mismo valor en los 4 lados</span><Switch checked={link} onChange={setLink} label="Enlazar márgenes" /></div>
                {[['t', 'Arriba'], ['b', 'Abajo'], ['l', 'Izquierda'], ['r', 'Derecha']].map(([k, l]) => (
                  <label key={k} className="field"><span>{l}</span><input type="range" min="0" max="45" step="0.5" value={m[k]} onChange={slide(k)} /><span className="field-val">{m[k]}%</span></label>
                ))}
              </Group>
            ) : (
              <Group>
                <label className="field"><span>Margen que se conserva</span><input type="range" min="0" max="50" value={pad} onChange={(e) => setPad(+e.target.value)} /><span className="field-val">{pad} pt</span></label>
                <div className="field"><span>Mismo recorte en todas las páginas<small>Conserva un tamaño uniforme</small></span><Switch checked={unify} onChange={setUnify} label="Unificar" /></div>
              </Group>
            )}
            <Group>
              <div className="field col"><span>Aplicar a</span>
                <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'odd', label: 'Impares' }, { value: 'even', label: 'Pares' }, { value: 'range', label: 'Rango' }]} />
              </div>
              {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
            </Group>
          </div>
          {mode === 'manual' && (
            <div className="pageview-wrap stack">
              <Pager page={prev} total={pdf.pages} onChange={setPrev} />
              <PageView doc={pdf.doc} page={prev} scale={1.1}>
                {({ w, h }) => {
                  const l = (m.l / 100) * w, r = (m.r / 100) * w, tp = (m.t / 100) * h, b = (m.b / 100) * h
                  const shade = 'rgba(0,0,0,.5)'
                  return (
                    <g pointerEvents="none">
                      <rect x="0" y="0" width={w} height={tp} fill={shade} />
                      <rect x="0" y={h - b} width={w} height={b} fill={shade} />
                      <rect x="0" y={tp} width={l} height={h - tp - b} fill={shade} />
                      <rect x={w - r} y={tp} width={r} height={h - tp - b} fill={shade} />
                      <rect x={l} y={tp} width={w - l - r} height={h - tp - b} fill="none" stroke="#007aff" strokeWidth="1.5" strokeDasharray="6 4" />
                    </g>
                  )
                }}
              </PageView>
            </div>
          )}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="crop" busy={t.busy} onClick={run}>Recortar PDF</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
