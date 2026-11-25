import { useState } from 'react'
import { PDFDocument } from '@cantoo/pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, Group, IconButton, PasswordInput, Result } from '../components/ui'
import { baseName, fmtSize, loadPdf, pdfBlob, readBytes } from '../lib/pdf'
import { useTask } from '../lib/hooks'

export default function Unlock() {
  const [file, setFile] = useState(null)
  const [needPw, setNeedPw] = useState(false)
  const [pw, setPw] = useState('')
  const t = useTask()

  const run = () =>
    t.run(async () => {
      let doc
      try {
        doc = await PDFDocument.load(await readBytes(file), { password: pw || undefined })
      } catch (e) {
        if (/password|encrypt/i.test(`${e?.message} ${e?.name}`)) {
          setNeedPw(true)
          throw new Error(pw ? 'La contraseña no es correcta.' : 'Este PDF necesita una contraseña para abrirse.')
        }
        throw new Error('No se pudo abrir el PDF. Puede estar dañado: prueba con «Reparar PDF».')
      }
      const wasLocked = doc.isEncrypted
      const bytes = await doc.save()
      const check = await loadPdf(new File([bytes], 'x.pdf')) // debe abrirse sin contraseña
      return {
        blob: pdfBlob(bytes),
        name: `${baseName(file.name)}_desbloqueado.pdf`,
        info: wasLocked ? `Protección eliminada · ${check.pages} páginas` : 'Este PDF no tenía contraseña; se generó una copia sin restricciones.',
      }
    })

  const reset = () => { t.reset(); setFile(null); setNeedPw(false); setPw('') }
  if (t.result) return <Result result={t.result} onReset={reset} />
  if (!file) return (
    <div className="stack narrow">
      <Dropzone accept=".pdf,application/pdf" title="Selecciona un PDF protegido" onFiles={(f) => { t.reset(); setFile(f[0]) }} />
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
        {needPw && <label className="field"><span>Contraseña</span><PasswordInput value={pw} onChange={setPw} autoFocus /></label>}
      </Group>
      <div className="note">Solo se puede quitar la protección si conoces la contraseña. Esta herramienta no la adivina ni la rompe.</div>
      <ErrorNote msg={t.error} />
      <ActionBar><Button icon="unlock" busy={t.busy} disabled={needPw && !pw} onClick={run}>Desbloquear PDF</Button></ActionBar>
    </div>
  )
}
