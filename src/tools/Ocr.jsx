import { useRef, useState } from 'react'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { Document, Packer, Paragraph } from 'docx'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, canvasToBlob, pdfBlob, rangeIndices, renderPage, safeText } from '../lib/pdf'
import { OCR_LANGS, createOcr } from '../lib/ocr'

export default function Ocr() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [lang, setLang] = useState('spa')
  const [scale, setScale] = useState(2)
  const [fmt, setFmt] = useState('pdf')
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [prog, setProg] = useState({ v: 0, label: '' })
  const stop = useRef(false)

  const run = () =>
    t.run(async () => {
      stop.current = false
      const idx = scope === 'all' ? Array.from({ length: pdf.pages }, (_, i) => i) : rangeIndices(range, pdf.pages)
      if (!idx.length) throw new Error('Indica qué páginas quieres procesar.')
      setProg({ v: 0, label: 'Preparando el reconocimiento de texto…' })
      let cur = 0
      const worker = await createOcr(lang, (m) => {
        const pct = Math.round((m.progress || 0) * 100)
        const what = m.status === 'recognizing text' ? 'Reconociendo texto' : 'Descargando idioma (la primera vez necesita conexión)'
        setProg({ v: (cur + (m.status === 'recognizing text' ? m.progress || 0 : 0)) / idx.length, label: `Página ${cur + 1} de ${idx.length} · ${what} ${pct}%` })
      })
      try {
        const out = fmt === 'pdf' ? await PDFDocument.create() : null
        const font = out ? await out.embedFont(StandardFonts.Helvetica) : null
        const texts = []
        let conf = 0
        for (const [k, i] of idx.entries()) {
          cur = k
          if (stop.current) throw new Error('Proceso cancelado.')
          const canvas = await renderPage(pdf.doc, i + 1, { scale })
          const { data } = await worker.recognize(canvas)
          conf += data.confidence || 0
          texts.push(data.text || '')
          if (out) {
            const vp = (await pdf.doc.getPage(i + 1)).getViewport({ scale: 1 })
            const img = await out.embedJpg(await (await canvasToBlob(canvas, 'image/jpeg', 0.85)).arrayBuffer())
            const page = out.addPage([vp.width, vp.height])
            page.drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height })
            const f = 1 / scale
            for (const w of data.words || []) {
              const txt = safeText(font, w.text || '')
              if (!txt.trim() || (w.confidence ?? 100) < 20) continue
              const h = (w.bbox.y1 - w.bbox.y0) * f
              page.drawText(txt, { x: w.bbox.x0 * f, y: vp.height - (w.bbox.y1 * f - h * 0.2), size: Math.max(1, h * 0.85), font, opacity: 0 })
            }
          }
          canvas.width = canvas.height = 0
        }
        const base = baseName(pdf.name)
        const avg = Math.round(conf / idx.length)
        const info = `${idx.length} ${idx.length === 1 ? 'página procesada' : 'páginas procesadas'} · confianza media ${avg}%`
        if (fmt === 'pdf') return { blob: pdfBlob(await out.save()), name: `${base}_ocr.pdf`, info: `${info}. El texto ya se puede buscar y copiar.` }
        if (fmt === 'txt') return { blob: new Blob([texts.map((x, n) => `--- Página ${idx[n] + 1} ---\n${x.trim()}`).join('\n\n')], { type: 'text/plain;charset=utf-8' }), name: `${base}.txt`, info }
        const paras = texts.flatMap((x, n) =>
          x.trim().split(/\n{2,}/).map((p, j) => new Paragraph({ pageBreakBefore: n > 0 && j === 0, spacing: { after: 140 }, text: p.replace(/\n/g, ' ').trim() })),
        )
        return { blob: await Packer.toBlob(new Document({ sections: [{ children: paras }] })), name: `${base}_ocr.docx`, info }
      } finally {
        await worker.terminate()
      }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input} title="Selecciona un PDF escaneado">
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Group>
            <label className="field"><span>Idioma del documento</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)}>{OCR_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            </label>
            <div className="field col"><span>Resultado</span>
              <Segmented value={fmt} onChange={setFmt} options={[{ value: 'pdf', label: 'PDF con texto' }, { value: 'docx', label: 'Word' }, { value: 'txt', label: 'Texto' }]} />
            </div>
            <div className="field col"><span>Calidad de lectura<small>Mayor calidad = más preciso y más lento</small></span>
              <Segmented value={scale} onChange={setScale} options={[{ value: 1.5, label: 'Rápida' }, { value: 2, label: 'Normal' }, { value: 3, label: 'Alta' }]} />
            </div>
            <div className="field col"><span>Páginas</span>
              <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Rango' }]} />
            </div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
          </Group>
          <div className="note">Todo se procesa en tu equipo. La primera vez se descarga el modelo del idioma elegido, por eso hace falta conexión a internet.</div>
          {t.busy && (
            <>
              <Progress value={prog.v} label={prog.label} />
              <Button variant="gray" onClick={() => { stop.current = true }}>Cancelar</Button>
            </>
          )}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="scan" busy={t.busy} onClick={run}>Reconocer texto</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
