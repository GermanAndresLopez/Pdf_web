import { useRef, useState } from 'react'
import { ActionBar, Button, ErrorNote, Group, Pager, Progress, Result, Segmented } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PageView, PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob, uid } from '../lib/pdf'
import { pageRuns } from '../lib/runs'
import { mergeReplaced, rasterizePdf } from '../lib/rasterize'

const PRESETS = {
  email: ['Correos', /[\w.+-]+@[\w-]+(\.[\w-]+)+/g],
  phone: ['Teléfonos', /(\+?\d{1,3}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?){2,4}\d{2,4}/g],
  date: ['Fechas', /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g],
  long: ['Números largos', /\b\d{6,}\b/g],
  url: ['Enlaces', /https?:\/\/\S+|www\.\S+/g],
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default function Redact() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [page, setPage] = useState(1)
  const [rects, setRects] = useState([]) // { id, page, x, y, w, h }
  const [term, setTerm] = useState('')
  const [color, setColor] = useState('#000000')
  const [scale, setScale] = useState(2)
  const [msg, setMsg] = useState('')
  const [busySearch, setBusySearch] = useState(false)
  const [prog, setProg] = useState(0)
  const cache = useRef({})

  const search = async (re) => {
    setBusySearch(true)
    setMsg('')
    try {
      const found = []
      for (let n = 1; n <= pdf.pages; n++) {
        const data = (cache.current[n] ||= await pageRuns(pdf.doc, n))
        for (const r of data.runs) {
          re.lastIndex = 0
          let m
          while ((m = re.exec(r.str))) {
            if (!m[0].trim()) { re.lastIndex++; continue }
            const f0 = m.index / r.str.length
            const f1 = (m.index + m[0].length) / r.str.length
            found.push({ id: uid(), page: n, x: r.x + r.w * f0 - 1, y: r.base - r.size * 0.95, w: r.w * (f1 - f0) + 2, h: r.size * 1.2 })
          }
        }
      }
      setRects((a) => [...a, ...found])
      setMsg(found.length ? `Se marcaron ${found.length} coincidencias en ${new Set(found.map((f) => f.page)).size} páginas.` : 'No se encontraron coincidencias. Si el PDF es un escaneado, aplica antes el OCR.')
      if (found.length) setPage(found[0].page)
    } finally {
      setBusySearch(false)
    }
  }

  const run = () =>
    t.run(async () => {
      const pages = [...new Set(rects.map((r) => r.page))].sort((a, b) => a - b)
      setProg(0)
      const rdoc = await rasterizePdf(pdf, {
        pages, scale, q: 0.9, keepText: false, onProgress: (n, tot) => setProg(n / tot),
        beforeEncode: (canvas, n, s) => {
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = color
          rects.filter((r) => r.page === n).forEach((r) => ctx.fillRect(r.x * s, r.y * s, r.w * s, r.h * s))
        },
      })
      const out = await mergeReplaced(pdf.bytes, rdoc, pages)
      return { blob: pdfBlob(await out.save()), name: `${baseName(pdf.name)}_censurado.pdf`, info: `${rects.length} áreas censuradas en ${pages.length} ${pages.length === 1 ? 'página' : 'páginas'}. El contenido tapado se ha eliminado de verdad.` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setRects([]) }} />
  const here = rects.filter((r) => r.page === page)
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack">
          <div className="narrow stack" style={{ width: '100%' }}>
            <FileCard pdf={pdf} onRemove={() => { setPdf(null); setRects([]); cache.current = {} }} />
            <Group>
              <label className="field"><span>Buscar texto</span><input type="text" placeholder="nombre, número, palabra…" value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && term.trim() && search(new RegExp(esc(term.trim()), 'gi'))} /></label>
              <div className="field"><span>Buscar patrones</span>
                <span className="field-btns">
                  {Object.entries(PRESETS).map(([k, [label, re]]) => <Button key={k} variant="gray" className="small" busy={busySearch} onClick={() => search(re)}>{label}</Button>)}
                </span>
              </div>
            </Group>
            {term.trim() && <Button variant="tinted" busy={busySearch} onClick={() => search(new RegExp(esc(term.trim()), 'gi'))}>Marcar «{term.trim()}» en todo el documento</Button>}
            {msg && <div className="note">{msg}</div>}
            <Group>
              <div className="field col"><span>Color del recuadro</span>
                <Segmented value={color} onChange={setColor} options={[{ value: '#000000', label: 'Negro' }, { value: '#ffffff', label: 'Blanco' }, { value: '#808080', label: 'Gris' }]} />
              </div>
              <div className="field col"><span>Calidad de las páginas censuradas</span>
                <Segmented value={scale} onChange={setScale} options={[{ value: 1.5, label: 'Normal' }, { value: 2, label: 'Alta' }, { value: 3, label: 'Máxima' }]} />
              </div>
            </Group>
          </div>
          <div className="pageview-wrap stack">
            <div className="toolrow" style={{ justifyContent: 'space-between' }}>
              <Pager page={page} total={pdf.pages} onChange={setPage} />
              <Button variant="danger" className="small" disabled={!rects.length} onClick={() => setRects([])}>Quitar todas ({rects.length})</Button>
            </div>
            <p className="hint">Arrastra sobre la página para marcar un área. Toca un recuadro para quitarlo.</p>
            <PageView doc={pdf.doc} page={page} draw onRect={(r) => setRects((a) => [...a, { id: uid(), page, ...r }])}>
              {here.map((r) => (
                <rect key={r.id} x={r.x} y={r.y} width={r.w} height={r.h} fill={color} fillOpacity=".6" stroke="#ff3b30" strokeWidth="1" style={{ cursor: 'pointer' }}
                  onPointerDown={(e) => { e.stopPropagation(); setRects((a) => a.filter((x) => x.id !== r.id)) }}>
                  <title>Quitar</title>
                </rect>
              ))}
            </PageView>
          </div>
          {t.busy && <Progress value={prog} label={`Censurando… ${Math.round(prog * 100)}%`} />}
          <div className="note narrow" style={{ margin: '0 auto' }}>Las páginas con censura se convierten en imagen para que el texto tapado desaparezca del archivo (no solo quede oculto). El resto de páginas no se modifican.</div>
          <ErrorNote msg={t.error} />
          <ActionBar info={`${rects.length} áreas marcadas`}><Button icon="redact" busy={t.busy} disabled={!rects.length} onClick={run}>Censurar y descargar</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
