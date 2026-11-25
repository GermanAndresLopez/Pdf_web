import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fmtSize, pdfBlob } from '../lib/pdf'
import { rasterizePdf } from '../lib/rasterize'

const LEVELS = {
  high: { scale: 0.9, q: 0.5, label: 'Máxima compresión' },
  mid: { scale: 1.3, q: 0.7, label: 'Recomendada' },
  low: { scale: 1.8, q: 0.85, label: 'Calidad alta' },
}
const LADDER = [[1.8, 0.8], [1.5, 0.7], [1.2, 0.6], [1.0, 0.5], [0.8, 0.4], [0.65, 0.3], [0.5, 0.25]]

export default function Compress() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('preset')
  const [level, setLevel] = useState('mid')
  const [scale, setScale] = useState(1.3)
  const [q, setQ] = useState(70)
  const [target, setTarget] = useState(1)
  const [gray, setGray] = useState(false)
  const [keepText, setKeepText] = useState(true)
  const [prog, setProg] = useState({ v: 0, label: '' })

  const raster = async (s, quality, label) => {
    const doc = await rasterizePdf(pdf, { scale: s, q: quality, mode: gray ? 'gray' : 'color', keepText, onProgress: (n, tot) => setProg({ v: n / tot, label: `${label} ${Math.round((n / tot) * 100)}%` }) })
    return doc.save()
  }

  const run = () =>
    t.run(async () => {
      let bytes
      let extra = ''
      if (mode === 'lossless') {
        const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true, updateMetadata: false })
        bytes = await doc.save({ useObjectStreams: true })
        if (bytes.length >= pdf.size) { bytes = pdf.bytes; extra = ' El archivo ya estaba optimizado; prueba otro modo para reducir más.' }
      } else if (mode === 'target') {
        const limit = target * 1048576
        for (const [i, [s, quality]] of LADDER.entries()) {
          bytes = await raster(s, quality, `Intento ${i + 1} de ${LADDER.length}…`)
          if (bytes.length <= limit) break
        }
        if (bytes.length > limit) extra = ` No se alcanzó el objetivo de ${target} MB; es el tamaño más pequeño posible con este método.`
      } else {
        const p = mode === 'custom' ? { scale, q: q / 100 } : LEVELS[level]
        bytes = await raster(p.scale, p.q, 'Comprimiendo…')
        if (bytes.length >= pdf.size) extra = ' El resultado no es menor que el original; prueba «Máxima compresión» o el modo sin pérdida.'
      }
      const diff = Math.round((1 - bytes.length / pdf.size) * 100)
      return { blob: pdfBlob(bytes), name: `${baseName(pdf.name)}_comprimido.pdf`, info: `${fmtSize(pdf.size)} → ${fmtSize(bytes.length)}${diff > 0 ? ` (−${diff}%)` : ''}.${extra}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Segmented value={mode} onChange={setMode} options={[{ value: 'lossless', label: 'Sin pérdida' }, { value: 'preset', label: 'Nivel' }, { value: 'custom', label: 'Personal' }, { value: 'target', label: 'Objetivo' }]} />
          {mode === 'lossless' && <div className="note">Reorganiza la estructura interna del PDF sin tocar el contenido. Reduce poco, pero conserva el texto, la nitidez y los vectores intactos.</div>}
          {mode === 'preset' && <Segmented value={level} onChange={setLevel} options={Object.entries(LEVELS).map(([value, v]) => ({ value, label: v.label }))} />}
          {mode === 'custom' && (
            <Group>
              <label className="field"><span>Resolución<small>Más alta = más nítido y más pesado</small></span><input type="range" min="0.5" max="2.5" step="0.1" value={scale} onChange={(e) => setScale(+e.target.value)} /><span className="field-val">{Math.round(scale * 72)} dpi</span></label>
              <label className="field"><span>Calidad de imagen</span><input type="range" min="20" max="95" value={q} onChange={(e) => setQ(+e.target.value)} /><span className="field-val">{q}%</span></label>
            </Group>
          )}
          {mode === 'target' && (
            <Group>
              <label className="field"><span>Tamaño máximo (MB)<small>Se reduce la calidad hasta cumplirlo</small></span><input type="number" min="0.1" step="0.1" value={target} onChange={(e) => setTarget(Math.max(0.1, +e.target.value || 1))} /></label>
            </Group>
          )}
          {mode !== 'lossless' && (
            <Group>
              <div className="field"><span>Conservar texto seleccionable<small>Añade una capa de texto invisible (pesa poco)</small></span><Switch checked={keepText} onChange={setKeepText} label="Conservar texto" /></div>
              <div className="field"><span>Convertir a escala de grises<small>Reduce más el tamaño</small></span><Switch checked={gray} onChange={setGray} label="Escala de grises" /></div>
            </Group>
          )}
          {mode !== 'lossless' && <div className="note">Para reducir el peso, cada página se convierte en una imagen optimizada. Es ideal para documentos escaneados o con muchas imágenes.</div>}
          {t.busy && mode !== 'lossless' && <Progress value={prog.v} label={prog.label} />}
          <ErrorNote msg={t.error} />
          <ActionBar info={`Tamaño actual: ${fmtSize(pdf.size)}`}><Button icon="compress" busy={t.busy} onClick={run}>Comprimir PDF</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
