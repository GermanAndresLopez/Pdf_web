import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fmtSize, pdfBlob } from '../lib/pdf'
import { rasterizePdf } from '../lib/rasterize'

export default function Flatten() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('forms')
  const [keepText, setKeepText] = useState(true)
  const [prog, setProg] = useState(0)

  const run = () =>
    t.run(async () => {
      if (mode === 'forms') {
        const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
        const n = doc.getForm().getFields().length
        doc.getForm().flatten()
        return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_aplanado.pdf`, info: n ? `${n} campos convertidos en contenido fijo` : 'El PDF no tenía campos de formulario' }
      }
      setProg(0)
      const out = await rasterizePdf(pdf, { scale: 2, q: 0.88, keepText, onProgress: (n, tot) => setProg(n / tot) })
      const bytes = await out.save()
      return { blob: pdfBlob(bytes), name: `${baseName(pdf.name)}_aplanado.pdf`, info: `Todo el contenido fusionado en cada página · ${fmtSize(bytes.length)}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Segmented value={mode} onChange={setMode} options={[{ value: 'forms', label: 'Solo formularios' }, { value: 'all', label: 'Todo (a imagen)' }]} />
          {mode === 'forms' ? (
            <div className="note">Los campos rellenables pasan a ser texto fijo: nadie podrá cambiar lo escrito. El texto y los gráficos siguen siendo vectoriales.</div>
          ) : (
            <>
              <div className="note">Cada página se convierte en una imagen que incluye formularios, anotaciones, comentarios y sellos. Es lo más seguro para compartir, pero el archivo puede pesar más.</div>
              <Group><div className="field"><span>Conservar texto buscable</span><Switch checked={keepText} onChange={setKeepText} label="Conservar texto" /></div></Group>
            </>
          )}
          {t.busy && mode === 'all' && <Progress value={prog} label={`Aplanando… ${Math.round(prog * 100)}%`} />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="layers" busy={t.busy} onClick={run}>Aplanar PDF</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
