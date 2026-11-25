import { useState } from 'react'
import * as XLSX from 'xlsx'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, Group, IconButton, Progress, Result, Segmented, Switch } from '../components/ui'
import { baseName, fmtSize, pdfBlob } from '../lib/pdf'
import { escapeHtml, htmlToPdf } from '../lib/html'
import { useTask } from '../lib/hooks'

export default function ExcelToPdf() {
  const [file, setFile] = useState(null)
  const [wb, setWb] = useState(null)
  const [sheets, setSheets] = useState(new Set())
  const [orient, setOrient] = useState('auto')
  const [size, setSize] = useState('a4')
  const [fontSize, setFontSize] = useState(11)
  const [grid, setGrid] = useState(true)
  const [titles, setTitles] = useState(true)
  const [prog, setProg] = useState(0)
  const t = useTask()

  const open = (f) =>
    t.run(async () => {
      const book = XLSX.read(await f[0].arrayBuffer(), { type: 'array' })
      if (!book.SheetNames.length) throw new Error('El archivo no contiene hojas.')
      setFile(f[0]); setWb(book); setSheets(new Set(book.SheetNames))
    })

  const run = () =>
    t.run(async () => {
      const names = wb.SheetNames.filter((n) => sheets.has(n))
      if (!names.length) throw new Error('Selecciona al menos una hoja.')
      const out = await PDFDocument.create()
      let k = 0
      for (const name of names) {
        const ws = wb.Sheets[name]
        if (!ws['!ref']) continue
        const table = XLSX.utils.sheet_to_html(ws).match(/<table[\s\S]*<\/table>/i)?.[0]
        if (!table) continue
        const cols = XLSX.utils.decode_range(ws['!ref']).e.c + 1
        const landscape = orient === 'auto' ? cols > 6 : orient === 'landscape'
        const style = `<style>table{font-family:Helvetica,Arial,sans-serif;font-size:${fontSize}px}td,th{${grid ? 'border:1px solid #c7c7cc;' : 'border:0;'}padding:4px 8px}</style>`
        const html = `${style}${titles ? `<h2 style="margin-top:0">${escapeHtml(name)}</h2>` : ''}${table}`
        const part = await PDFDocument.load(await htmlToPdf(html, { pageSize: size, landscape, margin: 40, font: 'sans', fontSize }))
        ;(await out.copyPages(part, part.getPageIndices())).forEach((p) => out.addPage(p))
        setProg(++k / names.length)
      }
      if (!out.getPageCount()) throw new Error('Las hojas seleccionadas están vacías.')
      const bytes = await out.save()
      return { blob: pdfBlob(bytes), name: `${baseName(file.name)}.pdf`, info: `${out.getPageCount()} páginas · ${fmtSize(bytes.length)}` }
    })

  const reset = () => { t.reset(); setFile(null); setWb(null) }
  if (t.result) return <Result result={t.result} onReset={reset} />
  if (!wb) return (
    <div className="stack narrow">
      <Dropzone accept=".xlsx,.xls,.csv,.ods" busy={t.busy} title="Selecciona una hoja de cálculo" hint="Excel, CSV u OpenDocument" onFiles={open} />
      <ErrorNote msg={t.error} />
    </div>
  )
  return (
    <div className="stack narrow">
      <Group>
        <div className="field">
          <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</b><small>{fmtSize(file.size)} · {wb.SheetNames.length} hojas</small></span>
          <IconButton icon="close" label="Quitar archivo" onClick={reset} />
        </div>
      </Group>
      {wb.SheetNames.length > 1 && (
        <div>
          <p className="section-label" style={{ marginTop: 0 }}>Hojas a convertir</p>
          <Group>
            {wb.SheetNames.map((n) => (
              <label key={n} className="field" style={{ cursor: 'pointer' }}>
                <span>{n}</span>
                <input type="checkbox" className="cb" checked={sheets.has(n)} onChange={() => setSheets((s) => { const c = new Set(s); c.has(n) ? c.delete(n) : c.add(n); return c })} />
              </label>
            ))}
          </Group>
        </div>
      )}
      <Group>
        <div className="field col"><span>Orientación</span><Segmented value={orient} onChange={setOrient} options={[{ value: 'auto', label: 'Automática' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} /></div>
        <div className="field col"><span>Tamaño de página</span><Segmented value={size} onChange={setSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Carta' }, { value: 'legal', label: 'Legal' }]} /></div>
        <label className="field"><span>Tamaño de letra</span><input type="range" min="8" max="16" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} /><span className="field-val">{fontSize}</span></label>
        <div className="field"><span>Líneas de cuadrícula</span><Switch checked={grid} onChange={setGrid} label="Cuadrícula" /></div>
        <div className="field"><span>Mostrar nombre de la hoja</span><Switch checked={titles} onChange={setTitles} label="Nombre de hoja" /></div>
      </Group>
      <div className="note">Si una tabla es más ancha que la página se reduce automáticamente para que quepa. El texto del PDF se puede buscar y copiar.</div>
      {t.busy && <Progress value={prog} label={`Convirtiendo… ${Math.round(prog * 100)}%`} />}
      <ErrorNote msg={t.error} />
      <ActionBar><Button icon="table" busy={t.busy} onClick={run}>Convertir a PDF</Button></ActionBar>
    </div>
  )
}
