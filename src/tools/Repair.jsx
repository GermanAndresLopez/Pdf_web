import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import { ActionBar, Button, Dropzone, ErrorNote, Group, IconButton, Progress, Result, Switch } from '../components/ui'
import { baseName, fmtSize, pdfBlob, readBytes } from '../lib/pdf'
import { rasterizePdf } from '../lib/rasterize'
import { useTask } from '../lib/hooks'

export default function Repair() {
  const [file, setFile] = useState(null)
  const [force, setForce] = useState(false)
  const [progress, setProgress] = useState(0)
  const t = useTask()

  const run = () =>
    t.run(async () => {
      const bytes = await readBytes(file)
      const name = `${baseName(file.name)}_reparado.pdf`
      // 1) Reconstruir la estructura copiando página a página
      if (!force) {
        try {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false, updateMetadata: false })
          const out = await PDFDocument.create()
          let ok = 0
          const total = src.getPageCount()
          for (let i = 0; i < total; i++) {
            try { const [p] = await out.copyPages(src, [i]); out.addPage(p); ok++ } catch { /* página dañada */ }
          }
          if (ok) {
            try { out.setTitle(src.getTitle() || ''); out.setAuthor(src.getAuthor() || '') } catch { /* sin metadatos */ }
            const res = await out.save()
            return { blob: pdfBlob(res), name, info: `${ok} de ${total} páginas recuperadas · estructura reconstruida (${fmtSize(res.length)})` }
          }
        } catch { /* se prueba el método 2 */ }
      }
      // 2) Último recurso: dibujar cada página y rehacer el PDF con imágenes
      let doc
      try { doc = await pdfjs.getDocument({ data: bytes.slice() }).promise } catch { throw new Error('No se pudo recuperar el archivo: está demasiado dañado.') }
      const pdf = { doc, pages: doc.numPages }
      const out = await rasterizePdf(pdf, { scale: 1.8, q: 0.85, keepText: true, onProgress: (n, tot) => setProgress(n / tot) })
      const res = await out.save()
      return { blob: pdfBlob(res), name, info: `Reconstruido a partir de imágenes: ${pdf.pages} páginas (el texto se conserva como capa buscable).` }
    })

  const reset = () => { t.reset(); setFile(null) }
  if (t.result) return <Result result={t.result} onReset={reset} />
  if (!file) return (
    <div className="stack narrow">
      <Dropzone accept=".pdf,application/pdf" title="Selecciona un PDF dañado" hint="Probaremos a recuperar todas las páginas posibles" onFiles={(f) => { t.reset(); setFile(f[0]) }} />
      <ErrorNote msg={t.error} />
    </div>
  )
  return (
    <div className="stack narrow">
      <Group>
        <div className="field">
          <span style={{ flex: 1, minWidth: 0 }}>
            <b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</b>
            <small>{fmtSize(file.size)}</small>
          </span>
          <IconButton icon="close" label="Quitar archivo" onClick={reset} />
        </div>
        <div className="field"><span>Reconstruir como imágenes<small>Más lento, pero funciona cuando falla el método normal</small></span><Switch checked={force} onChange={setForce} label="Reconstruir como imágenes" /></div>
      </Group>
      <div className="note">Primero se reconstruye la estructura interna del PDF (tabla de referencias, objetos dañados). Si no es posible, se redibujan las páginas como imágenes.</div>
      {t.busy && force && <Progress value={progress} label={`Reconstruyendo… ${Math.round(progress * 100)}%`} />}
      <ErrorNote msg={t.error} />
      <ActionBar><Button icon="wrench" busy={t.busy} onClick={run}>Reparar PDF</Button></ActionBar>
    </div>
  )
}
