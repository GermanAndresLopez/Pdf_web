import { useState } from 'react'
import { PDFDocument } from '@cantoo/pdf-lib'
import { ActionBar, Button, ErrorNote, Group, PasswordInput, Result, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, loadPdf, pdfBlob, uid } from '../lib/pdf'

const strength = (p) =>
  (p.length >= 8) + (p.length >= 12) + (/[a-z]/.test(p) && /[A-Z]/.test(p)) + /\d/.test(p) + /[^A-Za-z0-9]/.test(p)

export default function Protect() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [owner, setOwner] = useState('')
  const [perm, setPerm] = useState({ print: true, copy: true, modify: false, annotate: true })
  const s = strength(pw)
  const label = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte', 'Muy fuerte'][s]
  const color = ['#ff3b30', '#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#34c759'][s]
  const set = (k) => (v) => setPerm((p) => ({ ...p, [k]: v }))

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      doc.encrypt({
        userPassword: pw,
        ownerPassword: owner || uid() + uid(),
        permissions: {
          printing: perm.print ? 'highResolution' : false,
          modifying: perm.modify,
          copying: perm.copy,
          annotating: perm.annotate,
          fillingForms: perm.annotate,
          contentAccessibility: true,
          documentAssembly: perm.modify,
        },
      })
      const bytes = await doc.save()
      // Comprobar que el resultado realmente pide contraseña
      let ok = false
      try { await loadPdf(new File([bytes], 'x.pdf')) } catch (e) { ok = /contraseña/.test(e.message) }
      if (!ok) throw new Error('No se pudo verificar el cifrado. Prueba con otro archivo.')
      return { blob: pdfBlob(bytes), name: `${baseName(pdf.name)}_protegido.pdf`, info: 'PDF protegido. Guarda la contraseña en un lugar seguro: no se puede recuperar.' }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setPw(''); setPw2('') }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <div>
            <Group>
              <label className="field"><span>Contraseña</span><PasswordInput value={pw} onChange={setPw} autoFocus /></label>
              <label className="field"><span>Repetir</span><PasswordInput value={pw2} onChange={setPw2} placeholder="Repite la contraseña" /></label>
            </Group>
            {pw && (
              <>
                <div className="strength" style={{ marginTop: 10 }}><i style={{ width: `${(s / 5) * 100}%`, background: color }} /></div>
                <p className="hint" style={{ textAlign: 'left', padding: '0 16px' }}>Seguridad: {label}{pw2 && pw !== pw2 ? ' · Las contraseñas no coinciden' : ''}</p>
              </>
            )}
          </div>
          <div>
            <p className="section-label" style={{ marginTop: 0 }}>Permisos de quien abra el archivo</p>
            <Group>
              <div className="field"><span>Permitir imprimir</span><Switch checked={perm.print} onChange={set('print')} label="Imprimir" /></div>
              <div className="field"><span>Permitir copiar texto</span><Switch checked={perm.copy} onChange={set('copy')} label="Copiar" /></div>
              <div className="field"><span>Permitir anotar y rellenar formularios</span><Switch checked={perm.annotate} onChange={set('annotate')} label="Anotar" /></div>
              <div className="field"><span>Permitir modificar y ensamblar páginas</span><Switch checked={perm.modify} onChange={set('modify')} label="Modificar" /></div>
              <label className="field"><span>Contraseña de propietario<small>Opcional. Permite cambiar los permisos</small></span><PasswordInput value={owner} onChange={setOwner} placeholder="Opcional" /></label>
            </Group>
          </div>
          <div className="note">Los permisos los respetan la mayoría de lectores, pero solo la contraseña impide abrir el documento.</div>
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="lock" busy={t.busy} disabled={!pw || pw !== pw2} onClick={run}>Proteger PDF</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
