import { useEffect, useState } from 'react'
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Result, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob } from '../lib/pdf'

function describe(f, pages) {
  let page = 0
  try { page = pages.findIndex((p) => p.ref === f.acroField.getWidgets()[0].P()) + 1 } catch { /* sin página */ }
  const base = { name: f.getName(), page }
  if (f instanceof PDFTextField) return { ...base, kind: 'text', value: f.getText() || '', multiline: f.isMultiline(), max: f.getMaxLength() }
  if (f instanceof PDFCheckBox) return { ...base, kind: 'check', value: f.isChecked() }
  if (f instanceof PDFDropdown) return { ...base, kind: 'select', options: f.getOptions(), value: f.getSelected()[0] || '' }
  if (f instanceof PDFRadioGroup) return { ...base, kind: 'select', options: f.getOptions(), value: f.getSelected() || '' }
  if (f instanceof PDFOptionList) return { ...base, kind: 'multi', options: f.getOptions(), value: f.getSelected() }
  return null // botones y firmas
}

export default function FillForm() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [fields, setFields] = useState(null)
  const [vals, setVals] = useState({})
  const [flat, setFlat] = useState(false)

  useEffect(() => {
    if (!pdf) return
    PDFDocument.load(pdf.bytes, { ignoreEncryption: true }).then((doc) => {
      const pages = doc.getPages()
      const list = doc.getForm().getFields().map((f) => describe(f, pages)).filter(Boolean)
      setFields(list)
      setVals(Object.fromEntries(list.map((f) => [f.name, f.value])))
    })
  }, [pdf])

  const set = (name, v) => setVals((o) => ({ ...o, [name]: v }))

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const form = doc.getForm()
      for (const f of fields) {
        const field = form.getField(f.name)
        const v = vals[f.name]
        try {
          if (f.kind === 'text') field.setText(v || undefined)
          else if (f.kind === 'check') v ? field.check() : field.uncheck()
          else if (f.kind === 'select') v ? field.select(v) : field.clear?.()
          else if (f.kind === 'multi') { field.clear(); if (v.length) field.select(v) }
        } catch (e) {
          throw new Error(`No se pudo escribir en «${f.name}»: ${e.message}. Quizá contiene caracteres no compatibles.`)
        }
      }
      if (flat) form.flatten()
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_rellenado.pdf`, info: flat ? 'Formulario completado y aplanado (ya no se puede editar)' : 'Formulario completado; los campos siguen siendo editables' }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setFields(null) }} />
  const pagesWith = fields ? [...new Set(fields.map((f) => f.page))].sort((a, b) => a - b) : []
  return (
    <PdfGate input={input} title="Selecciona un PDF con formulario">
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => { setPdf(null); setFields(null) }} />
          {fields && !fields.length && (
            <div className="note">Este PDF no tiene campos de formulario rellenables. Para escribir sobre cualquier documento usa <a href="#/edit" style={{ color: 'var(--blue)' }}>Editar PDF</a>.</div>
          )}
          {pagesWith.map((pg) => (
            <div key={pg}>
              <p className="section-label" style={{ marginTop: 0 }}>{pg ? `Página ${pg}` : 'Campos'}</p>
              <Group>
                {fields.filter((f) => f.page === pg).map((f) => (
                  <div key={f.name} className={`field ${f.kind === 'text' && f.multiline ? 'col' : ''}`}>
                    <span style={{ maxWidth: '45%', overflowWrap: 'anywhere' }}>{f.name}</span>
                    {f.kind === 'text' && (f.multiline
                      ? <textarea style={{ textAlign: 'left', color: 'var(--text)', minHeight: 90 }} value={vals[f.name]} maxLength={f.max || undefined} onChange={(e) => set(f.name, e.target.value)} />
                      : <input type="text" value={vals[f.name]} maxLength={f.max || undefined} onChange={(e) => set(f.name, e.target.value)} />)}
                    {f.kind === 'check' && <Switch checked={!!vals[f.name]} onChange={(v) => set(f.name, v)} label={f.name} />}
                    {f.kind === 'select' && (
                      <select value={vals[f.name]} onChange={(e) => set(f.name, e.target.value)}>
                        <option value="">— Sin seleccionar —</option>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                    {f.kind === 'multi' && (
                      <select multiple value={vals[f.name]} style={{ height: 90 }} onChange={(e) => set(f.name, [...e.target.selectedOptions].map((o) => o.value))}>
                        {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    )}
                  </div>
                ))}
              </Group>
            </div>
          ))}
          {fields?.length > 0 && (
            <>
              <Group><div className="field"><span>Aplanar al guardar<small>Convierte los campos en texto fijo</small></span><Switch checked={flat} onChange={setFlat} label="Aplanar" /></div></Group>
              <Button variant="gray" onClick={() => setVals(Object.fromEntries(fields.map((f) => [f.name, f.kind === 'check' ? false : f.kind === 'multi' ? [] : ''])))}>Vaciar todos los campos</Button>
            </>
          )}
          <ErrorNote msg={t.error} />
          <ActionBar info={fields ? `${fields.length} campos` : ''}><Button icon="form" busy={t.busy} disabled={!fields?.length} onClick={run}>Guardar formulario</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
