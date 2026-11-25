import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, IconButton, Result } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fmtSize, pdfBlob, uid } from '../lib/pdf'

export default function Attach() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [files, setFiles] = useState([])

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      for (const { file } of files) {
        await doc.attach(new Uint8Array(await file.arrayBuffer()), file.name, {
          mimeType: file.type || 'application/octet-stream',
          creationDate: new Date(),
          modificationDate: new Date(file.lastModified || Date.now()),
        })
      }
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_adjuntos.pdf`, info: `${files.length} ${files.length === 1 ? 'archivo adjunto' : 'archivos adjuntos'} dentro del PDF` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setFiles([]) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Dropzone multiple compact={files.length > 0} title="Añadir archivos para incrustar" hint="Cualquier tipo de archivo" onFiles={(l) => setFiles((a) => [...a, ...l.map((file) => ({ id: uid(), file }))])} />
          {files.length > 0 && (
            <ul className="rows">
              {files.map((f) => (
                <li key={f.id} className="row">
                  <div className="row-main"><b>{f.file.name}</b><span>{fmtSize(f.file.size)}</span></div>
                  <IconButton icon="close" label="Quitar" onClick={() => setFiles((a) => a.filter((x) => x.id !== f.id))} />
                </li>
              ))}
            </ul>
          )}
          <div className="note">Los archivos viajan dentro del PDF y se ven en el panel de adjuntos de Acrobat y otros lectores.</div>
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="paperclip" busy={t.busy} disabled={!files.length} onClick={run}>Adjuntar archivos</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
