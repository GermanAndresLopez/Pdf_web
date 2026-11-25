import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, Chips, ErrorNote, Group, Progress, Result } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PageSelector, PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fmtSize, parseRanges, pdfBlob, renderPage, zipBlobs } from '../lib/pdf'

const MODES = [
  { value: 'ranges', label: 'Por rangos' },
  { value: 'every', label: 'Cada N páginas' },
  { value: 'size', label: 'Por tamaño' },
  { value: 'blank', label: 'Páginas en blanco' },
  { value: 'extract', label: 'Extraer páginas' },
]
const DESC = {
  ranges: 'Cada rango genera un PDF distinto. Ejemplo: 1-3, 5, 8-10',
  every: 'Crea un PDF cada cierto número de páginas.',
  size: 'Cada archivo resultante pesará menos del límite indicado.',
  blank: 'Corta el documento en las hojas en blanco y las descarta. Útil con lotes escaneados.',
  extract: 'Selecciona páginas y se juntan en un único PDF.',
}

async function isBlank(doc, n) {
  const c = await renderPage(doc, n, { scale: 0.3 })
  const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height).data
  let ink = 0
  for (let i = 0; i < d.length; i += 4) if (d[i] < 225 || d[i + 1] < 225 || d[i + 2] < 225) ink++
  return ink / (d.length / 4) < 0.003
}

export default function Split() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('ranges')
  const [ranges, setRanges] = useState('')
  const [every, setEvery] = useState(1)
  const [maxMb, setMaxMb] = useState(5)
  const [selected, setSelected] = useState(new Set())
  const [base, setBase] = useState('')
  const [prog, setProg] = useState(0)

  const run = () =>
    t.run(async () => {
      const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const name = base.trim() || baseName(pdf.name)
      const build = async (idx) => {
        const out = await PDFDocument.create()
        ;(await out.copyPages(src, idx)).forEach((p) => out.addPage(p))
        return out.save()
      }
      const all = src.getPageIndices()
      let groups = []
      let note = ''
      if (mode === 'ranges') groups = parseRanges(ranges, pdf.pages)
      else if (mode === 'every') groups = Array.from({ length: Math.ceil(all.length / every) }, (_, i) => all.slice(i * every, (i + 1) * every))
      else if (mode === 'extract') groups = [[...selected].sort((a, b) => a - b).map((n) => n - 1)]
      else if (mode === 'blank') {
        let cur = []
        let dropped = 0
        for (const i of all) {
          if (await isBlank(pdf.doc, i + 1)) { dropped++; if (cur.length) groups.push(cur); cur = [] } else cur.push(i)
          setProg((i + 1) / all.length)
        }
        if (cur.length) groups.push(cur)
        note = `${dropped} páginas en blanco descartadas`
        if (!dropped) throw new Error('No se encontró ninguna página en blanco.')
      } else {
        const limit = maxMb * 1048576
        const est = Math.max(1, Math.floor(limit / (pdf.size / pdf.pages)))
        const queue = Array.from({ length: Math.ceil(all.length / est) }, (_, i) => all.slice(i * est, (i + 1) * est))
        const files = []
        while (queue.length) {
          const idx = queue.shift()
          const bytes = await build(idx)
          if (bytes.length > limit && idx.length > 1) { const h = Math.ceil(idx.length / 2); queue.unshift(idx.slice(0, h), idx.slice(h)) }
          else files.push({ idx, bytes })
          setProg(1 - queue.length / (all.length || 1))
        }
        files.sort((a, b) => a.idx[0] - b.idx[0])
        if (files.length === 1) return { blob: pdfBlob(files[0].bytes), name: `${name}.pdf`, info: `El archivo ya pesa menos de ${maxMb} MB (${fmtSize(files[0].bytes.length)})` }
        const pad = String(files.length).length
        const zip = await zipBlobs(files.map((f, i) => ({ name: `${name}_${String(i + 1).padStart(pad, '0')}.pdf`, blob: pdfBlob(f.bytes) })))
        return { blob: zip, name: `${name}_dividido.zip`, info: `${files.length} archivos de menos de ${maxMb} MB` }
      }
      if (!groups.length || groups.every((g) => !g.length)) throw new Error(mode === 'extract' ? 'Selecciona al menos una página.' : 'Indica al menos un rango, por ejemplo: 1-3, 5')
      const pad = String(groups.length).length
      const files = []
      for (const [gi, g] of groups.entries()) {
        files.push({ name: groups.length === 1 ? `${name}_${mode === 'extract' ? 'extraido' : 'parte'}.pdf` : `${name}_${String(gi + 1).padStart(pad, '0')}.pdf`, blob: pdfBlob(await build(g)), pages: g.length })
      }
      if (files.length === 1) return { ...files[0], info: `${files[0].pages} páginas${note ? ' · ' + note : ''}` }
      return { blob: await zipBlobs(files), name: `${name}_dividido.zip`, info: `${files.length} archivos PDF dentro de un ZIP${note ? ' · ' + note : ''}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setRanges(''); setSelected(new Set()) }} />
  const disabled = (mode === 'ranges' && !ranges.trim()) || (mode === 'extract' && !selected.size)
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack">
          <div className="narrow stack" style={{ width: '100%' }}>
            <FileCard pdf={pdf} onRemove={() => { setPdf(null); setSelected(new Set()) }} />
            <Chips value={mode} onChange={setMode} options={MODES} />
            <p className="hint" style={{ textAlign: 'left' }}>{DESC[mode]}</p>
            <Group>
              {mode === 'ranges' && <label className="field"><span>Páginas</span><input type="text" inputMode="numeric" placeholder="1-3, 5, 8-10" value={ranges} onChange={(e) => setRanges(e.target.value)} /></label>}
              {mode === 'every' && <label className="field"><span>Páginas por archivo</span><input type="number" min="1" max={pdf.pages} value={every} onChange={(e) => setEvery(Math.max(1, +e.target.value || 1))} /></label>}
              {mode === 'size' && <label className="field"><span>Tamaño máximo (MB)</span><input type="number" min="0.1" step="0.5" value={maxMb} onChange={(e) => setMaxMb(Math.max(0.1, +e.target.value || 1))} /></label>}
              <label className="field"><span>Nombre base</span><input type="text" placeholder={baseName(pdf.name)} value={base} onChange={(e) => setBase(e.target.value)} /></label>
            </Group>
          </div>
          {mode === 'extract' && <PageSelector pdf={pdf} selected={selected} onChange={setSelected} />}
          {t.busy && ['blank', 'size'].includes(mode) && <Progress value={prog} label="Analizando…" />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="split" busy={t.busy} disabled={disabled} onClick={run}>{mode === 'extract' ? 'Extraer páginas' : 'Dividir PDF'}</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
