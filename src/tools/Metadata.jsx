import { useEffect, useState } from 'react'
import { PDFDocument, PDFName } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Result, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob } from '../lib/pdf'

const FIELDS = [
  ['title', 'Título', 'Title'],
  ['author', 'Autor', 'Author'],
  ['subject', 'Asunto', 'Subject'],
  ['keywords', 'Palabras clave', 'Keywords'],
  ['creator', 'Creado con', 'Creator'],
  ['producer', 'Generado por', 'Producer'],
]
const fmt = (d) => (d ? d.toLocaleString('es-ES') : '—')

export default function Metadata() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [vals, setVals] = useState(null)
  const [dates, setDates] = useState({})
  const [touch, setTouch] = useState(true)
  const [wipe, setWipe] = useState(false)

  useEffect(() => {
    if (!pdf) return
    PDFDocument.load(pdf.bytes, { ignoreEncryption: true, updateMetadata: false }).then((doc) => {
      setVals({ title: doc.getTitle() || '', author: doc.getAuthor() || '', subject: doc.getSubject() || '', keywords: doc.getKeywords() || '', creator: doc.getCreator() || '', producer: doc.getProducer() || '' })
      setDates({ created: doc.getCreationDate(), modified: doc.getModificationDate() })
    })
  }, [pdf])

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true, updateMetadata: false })
      const info = doc.getInfoDict()
      if (wipe) {
        ;[...FIELDS.map((f) => f[2]), 'CreationDate', 'ModDate'].forEach((k) => info.delete(PDFName.of(k)))
        doc.catalog.delete(PDFName.of('Metadata')) // XMP
      } else {
        doc.setTitle(vals.title)
        doc.setAuthor(vals.author)
        doc.setSubject(vals.subject)
        doc.setKeywords(vals.keywords.split(',').map((k) => k.trim()).filter(Boolean))
        doc.setCreator(vals.creator)
        doc.setProducer(vals.producer)
        FIELDS.forEach(([k, , key]) => { if (!vals[k].trim()) info.delete(PDFName.of(key)) })
        if (touch) doc.setModificationDate(new Date())
      }
      return { blob: pdfBlob(await doc.save({ updateFieldAppearances: false })), name: `${baseName(pdf.name)}_metadatos.pdf`, info: wipe ? 'Metadatos eliminados' : 'Metadatos actualizados' }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setVals(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && vals && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => { setPdf(null); setVals(null) }} />
          <div className="group">
            <div className="field"><span>Creado</span><span className="field-val">{fmt(dates.created)}</span></div>
            <div className="field"><span>Modificado</span><span className="field-val">{fmt(dates.modified)}</span></div>
          </div>
          {!wipe && (
            <Group>
              {FIELDS.map(([k, label]) => (
                <label key={k} className="field"><span>{label}</span><input type="text" value={vals[k]} placeholder={k === 'keywords' ? 'separadas por comas' : ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} /></label>
              ))}
              <div className="field"><span>Actualizar fecha de modificación</span><Switch checked={touch} onChange={setTouch} label="Actualizar fecha" /></div>
            </Group>
          )}
          <Group>
            <div className="field"><span>Eliminar todos los metadatos<small>Útil para compartir el archivo sin dejar rastro de autor ni programa</small></span><Switch checked={wipe} onChange={setWipe} label="Eliminar todos" /></div>
          </Group>
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="info" busy={t.busy} onClick={run}>{wipe ? 'Eliminar metadatos' : 'Guardar metadatos'}</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
