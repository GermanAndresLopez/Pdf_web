import { useState } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Result, Segmented, Switch } from '../components/ui'
import PdfThumb, { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob, rangeIndices } from '../lib/pdf'

export default function Rotate() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [kind, setKind] = useState('fixed')
  const [angle, setAngle] = useState(90)
  const [free, setFree] = useState(2)
  const [keep, setKeep] = useState(true)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')

  const run = () =>
    t.run(async () => {
      const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const total = src.getPageCount()
      const all = Array.from({ length: total }, (_, i) => i)
      const target = new Set(scope === 'all' ? all : scope === 'odd' ? all.filter((i) => i % 2 === 0) : scope === 'even' ? all.filter((i) => i % 2 === 1) : rangeIndices(range, total))
      if (!target.size) throw new Error('No hay páginas seleccionadas.')

      if (kind === 'fixed') {
        src.getPages().forEach((p, i) => { if (target.has(i)) p.setRotation(degrees((((p.getRotation().angle + angle) % 360) + 360) % 360)) })
        return { blob: pdfBlob(await src.save()), name: `${baseName(pdf.name)}_girado.pdf`, info: `${target.size} páginas giradas ${angle}°` }
      }

      // Ángulo libre (enderezar escaneos): se redibuja la página girada sobre una página nueva
      const out = await PDFDocument.create()
      const th = (free * Math.PI) / 180
      const cos = Math.cos(th), sin = Math.sin(th)
      for (let i = 0; i < total; i++) {
        if (!target.has(i)) { const [p] = await out.copyPages(src, [i]); out.addPage(p); continue }
        const [emb] = await out.embedPdf(src, [i])
        const { width: w, height: h } = emb
        if (keep) {
          const page = out.addPage([w, h])
          page.drawPage(emb, { x: w / 2 - ((w / 2) * cos - (h / 2) * sin), y: h / 2 - ((w / 2) * sin + (h / 2) * cos), rotate: degrees(free) })
        } else {
          const xs = [0, w * cos, w * cos - h * sin, -h * sin]
          const ys = [0, w * sin, w * sin + h * cos, h * cos]
          const minX = Math.min(...xs), minY = Math.min(...ys)
          const page = out.addPage([Math.max(...xs) - minX, Math.max(...ys) - minY])
          page.drawPage(emb, { x: -minX, y: -minY, rotate: degrees(free) })
        }
      }
      return { blob: pdfBlob(await out.save()), name: `${baseName(pdf.name)}_enderezado.pdf`, info: `${target.size} páginas giradas ${free}°` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  const deg = kind === 'fixed' ? angle : -free
  const odd = kind === 'fixed' && angle % 180 === 90
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <div style={{ width: 170, margin: '4px auto', aspectRatio: '3 / 4', display: 'grid', placeItems: 'center', overflow: 'hidden', background: 'var(--fill)', borderRadius: 10 }}>
            <div style={{ width: '70%', transform: `rotate(${deg}deg) scale(${odd ? 0.72 : 1})`, transition: 'transform .4s var(--ease)', boxShadow: '0 2px 8px rgba(0,0,0,.18)' }}>
              <PdfThumb doc={pdf.doc} width={120} />
            </div>
          </div>
          <Segmented value={kind} onChange={setKind} options={[{ value: 'fixed', label: 'Giro de 90°' }, { value: 'free', label: 'Enderezar (ángulo libre)' }]} />
          <Group>
            {kind === 'fixed' ? (
              <div className="field col"><span>Ángulo</span>
                <Segmented value={angle} onChange={setAngle} options={[{ value: 90, label: '90° →' }, { value: 180, label: '180°' }, { value: 270, label: '← 90°' }]} />
              </div>
            ) : (
              <>
                <label className="field"><span>Ángulo<small>Positivo = sentido antihorario</small></span><input type="range" min="-45" max="45" step="0.1" value={free} onChange={(e) => setFree(+e.target.value)} /><span className="field-val">{free.toFixed(1)}°</span></label>
                <div className="field"><span>Mantener tamaño de página<small>Si lo desactivas, la página crece para que no se corte nada</small></span><Switch checked={keep} onChange={setKeep} label="Mantener tamaño" /></div>
              </>
            )}
            <div className="field col"><span>Aplicar a</span>
              <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'odd', label: 'Impares' }, { value: 'even', label: 'Pares' }, { value: 'range', label: 'Rango' }]} />
            </div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
          </Group>
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="rotate" busy={t.busy} disabled={kind === 'free' && free === 0} onClick={run}>{kind === 'fixed' ? 'Girar PDF' : 'Enderezar PDF'}</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
