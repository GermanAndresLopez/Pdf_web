import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Result, Segmented } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PageSelector, PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob } from '../lib/pdf'

export default function DeletePages() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [mode, setMode] = useState('delete')
  const [selected, setSelected] = useState(new Set())

  const keep = pdf ? Array.from({ length: pdf.pages }, (_, i) => i + 1).filter((n) => (mode === 'delete' ? !selected.has(n) : selected.has(n))) : []

  const run = () =>
    t.run(async () => {
      if (!keep.length) throw new Error('El resultado no tendría ninguna página.')
      const src = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const out = await PDFDocument.create()
      ;(await out.copyPages(src, keep.map((n) => n - 1))).forEach((p) => out.addPage(p))
      return { blob: pdfBlob(await out.save()), name: `${baseName(pdf.name)}_${mode === 'delete' ? 'sin_paginas' : 'extraido'}.pdf`, info: `${keep.length} de ${pdf.pages} páginas` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setSelected(new Set()) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack">
          <div className="narrow stack" style={{ width: '100%' }}>
            <FileCard pdf={pdf} onRemove={() => { setPdf(null); setSelected(new Set()) }} />
            <Segmented value={mode} onChange={setMode} options={[{ value: 'delete', label: 'Eliminar las seleccionadas' }, { value: 'keep', label: 'Conservar solo las seleccionadas' }]} />
          </div>
          <PageSelector pdf={pdf} selected={selected} onChange={setSelected} />
          <ErrorNote msg={t.error} />
          <ActionBar info={`El PDF final tendrá ${keep.length} de ${pdf.pages} páginas`}>
            <Button icon="trash" busy={t.busy} disabled={!selected.size || !keep.length} onClick={run}>{mode === 'delete' ? 'Eliminar páginas' : 'Extraer páginas'}</Button>
          </ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
