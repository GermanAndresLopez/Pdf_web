import { useState } from 'react'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, canvasToBlob, rangeIndices, renderPage, zipBlobs } from '../lib/pdf'

const TYPES = { png: ['image/png', 'png'], jpg: ['image/jpeg', 'jpg'], webp: ['image/webp', 'webp'] }

export default function PdfToImg() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [fmt, setFmt] = useState('png')
  const [dpi, setDpi] = useState(150)
  const [q, setQ] = useState(92)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [join, setJoin] = useState(false)
  const [name, setName] = useState('')
  const [prog, setProg] = useState(0)

  const run = () =>
    t.run(async () => {
      const idx = scope === 'all' ? Array.from({ length: pdf.pages }, (_, i) => i) : rangeIndices(range, pdf.pages)
      if (!idx.length) throw new Error('Indica qué páginas convertir.')
      const [mime, ext] = TYPES[fmt]
      const base = name.trim() || baseName(pdf.name)
      const scale = dpi / 72
      const encode = (c) => canvasToBlob(c, mime, q / 100)
      setProg(0)

      if (join) {
        const parts = []
        for (const [k, i] of idx.entries()) { parts.push(await renderPage(pdf.doc, i + 1, { scale })); setProg((k + 1) / idx.length) }
        const W = Math.max(...parts.map((p) => p.width))
        const H = parts.reduce((s, p) => s + p.height, 0)
        if (W * H > 200e6) throw new Error('La imagen resultante sería demasiado grande. Baja la resolución o reduce las páginas.')
        const big = document.createElement('canvas')
        big.width = W; big.height = H
        const x = big.getContext('2d')
        x.fillStyle = '#fff'; x.fillRect(0, 0, W, H)
        let y = 0
        parts.forEach((p) => { x.drawImage(p, (W - p.width) / 2, y); y += p.height; p.width = p.height = 0 })
        return { blob: await encode(big), name: `${base}.${ext}`, info: `${idx.length} páginas en una sola imagen (${W}×${H}px)` }
      }

      const files = []
      const pad = String(pdf.pages).length
      for (const [k, i] of idx.entries()) {
        const c = await renderPage(pdf.doc, i + 1, { scale })
        files.push({ name: `${base}_pagina_${String(i + 1).padStart(pad, '0')}.${ext}`, blob: await encode(c) })
        c.width = c.height = 0
        setProg((k + 1) / idx.length)
      }
      if (files.length === 1) return { ...files[0], info: '1 imagen generada' }
      return { blob: await zipBlobs(files), name: `${base}_imagenes.zip`, info: `${files.length} imágenes dentro de un ZIP` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Group>
            <div className="field col"><span>Formato</span><Segmented value={fmt} onChange={setFmt} options={[{ value: 'png', label: 'PNG' }, { value: 'jpg', label: 'JPG' }, { value: 'webp', label: 'WEBP' }]} /></div>
            <div className="field col"><span>Resolución</span><Segmented value={dpi} onChange={setDpi} options={[{ value: 72, label: '72 dpi' }, { value: 150, label: '150 dpi' }, { value: 220, label: '220 dpi' }, { value: 300, label: '300 dpi' }]} /></div>
            {fmt !== 'png' && <label className="field"><span>Calidad</span><input type="range" min="40" max="100" value={q} onChange={(e) => setQ(+e.target.value)} /><span className="field-val">{q}%</span></label>}
            <div className="field col"><span>Páginas</span><Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Rango' }]} /></div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
            <div className="field col"><span>Salida</span><Segmented value={join} onChange={setJoin} options={[{ value: false, label: 'Una imagen por página' }, { value: true, label: 'Una imagen larga' }]} /></div>
            <label className="field"><span>Nombre de archivo</span><input type="text" placeholder={baseName(pdf.name)} value={name} onChange={(e) => setName(e.target.value)} /></label>
          </Group>
          {t.busy && <Progress value={prog} label={`Convirtiendo… ${Math.round(prog * 100)}%`} />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="image" busy={t.busy} onClick={run}>Convertir a imágenes</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
