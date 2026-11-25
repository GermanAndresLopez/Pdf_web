import { useState } from 'react'
import PptxGenJS from 'pptxgenjs'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, canvasToBlob, rangeIndices, renderPage } from '../lib/pdf'
import { extractRuns } from '../lib/runs'

const FACES = { sans: 'Arial', serif: 'Times New Roman', mono: 'Courier New' }
const blobToDataUrl = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b) })

export default function PdfToPptx() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('image')
  const [scale, setScale] = useState(2)
  const [notes, setNotes] = useState(true)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [prog, setProg] = useState(0)

  const run = () =>
    t.run(async () => {
      const idx = scope === 'all' ? Array.from({ length: pdf.pages }, (_, i) => i) : rangeIndices(range, pdf.pages)
      if (!idx.length) throw new Error('Indica qué páginas convertir.')
      const pptx = new PptxGenJS()
      const first = (await pdf.doc.getPage(idx[0] + 1)).getViewport({ scale: 1 })
      const W = first.width / 72, H = first.height / 72
      pptx.defineLayout({ name: 'PDF', width: W, height: H })
      pptx.layout = 'PDF'
      for (const [k, i] of idx.entries()) {
        const pg = await pdf.doc.getPage(i + 1)
        const vp = pg.getViewport({ scale: 1 })
        const f = first.width / vp.width // pt de la diapositiva por pt de la página
        const slide = pptx.addSlide()
        const runs = await extractRuns(pg, vp.height).catch(() => [])
        if (mode === 'image') {
          const canvas = await renderPage(pdf.doc, i + 1, { scale })
          slide.addImage({ data: await blobToDataUrl(await canvasToBlob(canvas, 'image/jpeg', 0.88)), x: 0, y: 0, w: (vp.width * f) / 72, h: (vp.height * f) / 72 })
          canvas.width = canvas.height = 0
        } else {
          runs.forEach((r) => {
            slide.addText(r.str, {
              x: (r.x * f) / 72, y: ((r.base - r.size * 0.9) * f) / 72, w: ((r.w + 6) * f) / 72, h: (r.size * 1.25 * f) / 72,
              fontSize: Math.max(4, r.size * f), fontFace: FACES[r.family], bold: r.bold, italic: r.italic, color: '000000',
              margin: 0, valign: 'top', wrap: false, fit: 'none',
            })
          })
        }
        if (notes && runs.length) slide.addNotes(runs.map((r) => r.str).join('\n'))
        setProg((k + 1) / idx.length)
      }
      const blob = await pptx.write({ outputType: 'blob' })
      return { blob, name: `${baseName(pdf.name)}.pptx`, info: `${idx.length} ${idx.length === 1 ? 'diapositiva' : 'diapositivas'} · ${mode === 'image' ? 'fieles al original' : 'con texto editable'}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Group>
            <div className="field col"><span>Tipo de diapositiva</span>
              <Segmented value={mode} onChange={setMode} options={[{ value: 'image', label: 'Imagen fiel' }, { value: 'text', label: 'Texto editable' }]} />
            </div>
            {mode === 'image' && <div className="field col"><span>Calidad de imagen</span><Segmented value={scale} onChange={setScale} options={[{ value: 1.5, label: 'Normal' }, { value: 2, label: 'Alta' }, { value: 3, label: 'Máxima' }]} /></div>}
            <div className="field"><span>Texto en las notas del orador<small>Permite buscar y copiar el contenido</small></span><Switch checked={notes} onChange={setNotes} label="Notas" /></div>
            <div className="field col"><span>Páginas</span><Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Rango' }]} /></div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
          </Group>
          <div className="note">«Imagen fiel» reproduce cada página exactamente. «Texto editable» crea cuadros de texto que puedes modificar en PowerPoint, pero no incluye imágenes ni gráficos.</div>
          {t.busy && <Progress value={prog} label={`Creando diapositivas… ${Math.round(prog * 100)}%`} />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="slides" busy={t.busy} onClick={run}>Convertir a PowerPoint</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
