import { useState } from 'react'
import * as XLSX from 'xlsx'
import { ActionBar, Button, ErrorNote, Group, Progress, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, rangeIndices } from '../lib/pdf'
import { pageLines, toGrid } from '../lib/runs'

function toNumber(s) {
  const t = s.trim()
  if (/^-?\d+([.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'))
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return parseFloat(t.replace(/\./g, '').replace(',', '.'))
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return parseFloat(t.replace(/,/g, ''))
  return null
}

export default function PdfToExcel() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [layout, setLayout] = useState('pages')
  const [format, setFormat] = useState('xlsx')
  const [onlyTables, setOnlyTables] = useState(false)
  const [numbers, setNumbers] = useState(true)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [prog, setProg] = useState(0)

  const run = () =>
    t.run(async () => {
      const idx = scope === 'all' ? Array.from({ length: pdf.pages }, (_, i) => i) : rangeIndices(range, pdf.pages)
      if (!idx.length) throw new Error('Indica qué páginas convertir.')
      const sheets = []
      for (const [k, i] of idx.entries()) {
        let lines = await pageLines(pdf.doc, i + 1)
        if (onlyTables) lines = lines.filter((l, j) => l.cells.length > 1 || lines[j - 1]?.cells.length > 1 || lines[j + 1]?.cells.length > 1)
        let rows = lines.length ? toGrid(lines) : []
        if (numbers) rows = rows.map((r) => r.map((c) => { const n = c ? toNumber(c) : null; return n === null ? c : n }))
        sheets.push({ n: i + 1, rows })
        setProg((k + 1) / idx.length)
      }
      if (!sheets.some((s) => s.rows.length)) throw new Error('No se encontró texto seleccionable. Si el PDF es un escaneado, aplica antes el OCR.')
      const base = baseName(pdf.name)
      const wb = XLSX.utils.book_new()
      const mk = (rows) => {
        const ws = XLSX.utils.aoa_to_sheet(rows)
        ws['!cols'] = (rows[0] || []).map((_, c) => ({ wch: Math.min(60, Math.max(8, ...rows.map((r) => String(r[c] ?? '').length)) + 2) }))
        return ws
      }
      if (layout === 'single' || format === 'csv') {
        const all = sheets.flatMap((s) => s.rows)
        const w = Math.max(...all.map((r) => r.length), 0)
        XLSX.utils.book_append_sheet(wb, mk(all.map((r) => [...r, ...Array(w - r.length).fill('')])), 'PDF')
      } else {
        sheets.filter((s) => s.rows.length).forEach((s) => XLSX.utils.book_append_sheet(wb, mk(s.rows), `Página ${s.n}`.slice(0, 31)))
      }
      if (format === 'csv') {
        const csv = '﻿' + XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
        return { blob: new Blob([csv], { type: 'text/csv;charset=utf-8' }), name: `${base}.csv`, info: `${sheets.reduce((s, x) => s + x.rows.length, 0)} filas exportadas` }
      }
      const blob = new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      return { blob, name: `${base}.xlsx`, info: `${wb.SheetNames.length} ${wb.SheetNames.length === 1 ? 'hoja' : 'hojas'} · ${sheets.reduce((s, x) => s + x.rows.length, 0)} filas` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
          <Group>
            <div className="field col"><span>Formato</span><Segmented value={format} onChange={setFormat} options={[{ value: 'xlsx', label: 'Excel (.xlsx)' }, { value: 'csv', label: 'CSV' }]} /></div>
            {format === 'xlsx' && <div className="field col"><span>Organización</span><Segmented value={layout} onChange={setLayout} options={[{ value: 'pages', label: 'Una hoja por página' }, { value: 'single', label: 'Una sola hoja' }]} /></div>}
            <div className="field"><span>Detectar números<small>Los convierte para poder calcular con ellos</small></span><Switch checked={numbers} onChange={setNumbers} label="Detectar números" /></div>
            <div className="field"><span>Solo filas con varias columnas<small>Ignora párrafos de texto suelto</small></span><Switch checked={onlyTables} onChange={setOnlyTables} label="Solo tablas" /></div>
            <div className="field col"><span>Páginas</span><Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'range', label: 'Rango' }]} /></div>
            {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
          </Group>
          <div className="note">Las columnas se detectan por la posición del texto. Funciona mejor con tablas simples; revisa el resultado en tablas complejas.</div>
          {t.busy && <Progress value={prog} label={`Analizando… ${Math.round(prog * 100)}%`} />}
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="table" busy={t.busy} onClick={run}>Convertir a Excel</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
