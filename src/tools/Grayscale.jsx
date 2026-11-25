import { useState } from 'react'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fmtSize, pdfBlob, rangeIndices } from '../lib/pdf'
import { mergeReplaced, rasterizePdf } from '../lib/rasterize'

export default function Grayscale() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('gray')
  const [threshold, setThreshold] = useState(170)
  const [scale, setScale] = useState(1.8)
  const [keepText, setKeepText] = useState(true)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [prog, setProg] = useState(0)

  const run = () =>
    t.run(async () => {
      const pages = scope === 'all' ? Array.from({ length: pdf.pages }, (_, i) => i + 1) : rangeIndices(range, pdf.pages).map((i) => i + 1)
      if (!pages.length) throw new Error('Indica qué páginas convertir.')
      setProg(0)
      const rdoc = await rasterizePdf(pdf, { pages, scale, q: 0.8, mode, threshold, keepText, onProgress: (n, tot) => setProg(n / tot) })
      const out = scope === 'all' ? rdoc : await mergeReplaced(pdf.bytes, rdoc, pages)
      const bytes = await out.save()
      return { blob: pdfBlob(bytes), name: `${baseName(pdf.name)}_${mode === 'gray' ? 'grises' : 'bn'}.pdf`, info: `${pages.length} páginas convertidas · ${fmtSize(pdf.size)} → ${fmtSize(bytes.length)}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Group>
            <div className="field col"><span>Modo</span>
              <Segmented value={mode} onChange={setMode} options={[{ value: 'gray', label: 'Escala de grises' }, { value: 'bw', label: 'Blanco y negro' }]} />
            </div>
            {mode === 'bw' && <label className="field"><span>Umbral<small>Más alto = más negro</small></span><input type="range" min="60" max="230" value={threshold} onChange={(e) => setThreshold(+e.target.value)} /><span className="field-val">{threshold}</span></label>}
            <div className="field col"><span>Calidad</span>
              <Segmented value={scale} onChange={setScale} options={[{ value: 1.3, label: 'Normal' }, { value: 1.8, label: 'Alta' }, { value: 2.5, label: 'Máxima' }]} />
            </div>
            <div className="field"><span>Conservar texto buscable<small>Añade una capa de texto invisible</small></span><Switch checked={keepText} onChange={setKeepText} label="Conservar texto" /></div>
            <div className="field col"><span>Páginas</span>
              <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Rango' }]} />
            </div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
          </Group>
          {t.busy && <Progress value={prog} label={`Convirtiendo… ${Math.round(prog * 100)}%`} />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="contrast" busy={t.busy} onClick={run}>Convertir</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
