import { useState } from 'react'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, rangeIndices } from '../lib/pdf'
import { pdfToDocx } from '../lib/word'
import { OCR_LANGS } from '../lib/ocr'

export default function PdfToWord() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [tables, setTables] = useState(true)
  const [lists, setLists] = useState(true)
  const [keepBreaks, setKeepBreaks] = useState(false)
  const [ocr, setOcr] = useState(false)
  const [lang, setLang] = useState('spa')
  const [prog, setProg] = useState({ v: 0, label: '' })

  const run = () =>
    t.run(async () => {
      const pages = scope === 'all' ? undefined : rangeIndices(range, pdf.pages).map((i) => i + 1)
      if (pages && !pages.length) throw new Error('Indica qué páginas convertir.')
      const blob = await pdfToDocx(pdf, { pages, tables, lists, keepBreaks, ocr: ocr ? { lang, scale: 2 } : null, onProgress: (v, label) => setProg((p) => ({ v, label: label || p.label })) })
      return { blob, name: `${baseName(pdf.name)}.docx`, info: 'Documento de Word generado' }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Group>
            <div className="field col"><span>Páginas</span><Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Rango' }]} /></div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
            <div className="field"><span>Detectar tablas<small>Las filas alineadas en columnas pasan a tablas de Word</small></span><Switch checked={tables} onChange={setTables} label="Tablas" /></div>
            <div className="field"><span>Detectar listas con viñetas</span><Switch checked={lists} onChange={setLists} label="Listas" /></div>
            <div className="field"><span>Conservar los saltos de línea<small>Cada línea del PDF será un párrafo</small></span><Switch checked={keepBreaks} onChange={setKeepBreaks} label="Saltos de línea" /></div>
            <div className="field"><span>Usar OCR en páginas escaneadas<small>Requiere conexión la primera vez</small></span><Switch checked={ocr} onChange={setOcr} label="OCR" /></div>
            {ocr && <label className="field"><span>Idioma del OCR</span><select value={lang} onChange={(e) => setLang(e.target.value)}>{OCR_LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>}
          </Group>
          <div className="note">Se extrae el texto y se reconstruyen párrafos, títulos, listas y tablas para que puedas editarlo en Word. Las imágenes y el diseño exacto (columnas, colores) no se conservan.</div>
          {t.busy && <Progress value={prog.v} label={prog.label} />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="word" busy={t.busy} onClick={run}>Convertir a Word</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
