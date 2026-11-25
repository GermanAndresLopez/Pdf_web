import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, Group, IconButton, Result, Switch } from '../components/ui'
import PdfThumb from '../components/PdfThumb'
import { baseName, fmtSize, loadPdf, pdfBlob, rangeIndices } from '../lib/pdf'
import { setOutline } from '../lib/outline'
import { moveItem, useReorder, useTask } from '../lib/hooks'

const safeRange = (f) => {
  if (!f.range.trim()) return { idx: null, count: f.pages }
  try { const idx = rangeIndices(f.range, f.pages); return { idx, count: idx.length } } catch (e) { return { idx: null, count: 0, error: e.message } }
}

export default function Merge() {
  const [files, setFiles] = useState([])
  const [marks, setMarks] = useState(false)
  const [name, setName] = useState('unido')
  const t = useTask()
  const drag = useReorder(setFiles)

  const add = (list) =>
    t.run(async () => {
      const loaded = []
      for (const f of list) loaded.push({ ...(await loadPdf(f)), range: '' })
      setFiles((a) => [...a, ...loaded])
    })

  const merge = () =>
    t.run(async () => {
      const out = await PDFDocument.create()
      const items = []
      for (const f of files) {
        const r = safeRange(f)
        if (r.error) throw new Error(`«${f.name}»: ${r.error}`)
        const src = await PDFDocument.load(f.bytes, { ignoreEncryption: true })
        items.push({ title: baseName(f.name), page: out.getPageCount() + 1, level: 0 })
        const pages = await out.copyPages(src, r.idx || src.getPageIndices())
        pages.forEach((p) => out.addPage(p))
      }
      if (marks) setOutline(out, items)
      const bytes = await out.save()
      return { blob: pdfBlob(bytes), name: `${name.trim() || 'unido'}.pdf`, info: `${out.getPageCount()} páginas · ${fmtSize(bytes.length)}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setFiles([]) }} />

  const total = files.reduce((s, f) => s + safeRange(f).count, 0)
  return (
    <div className="stack narrow">
      <Dropzone accept=".pdf,application/pdf" multiple busy={t.busy && !files.length} compact={files.length > 0} title={files.length ? 'Añadir más PDF' : 'Selecciona tus PDF'} hint="Puedes elegir varios a la vez" onFiles={add} />
      <ErrorNote msg={t.error} />
      {files.length > 0 && (
        <>
          <div className="toolrow">
            <Button variant="gray" className="small" onClick={() => setFiles((a) => [...a].sort((x, y) => x.name.localeCompare(y.name, 'es', { numeric: true })))}>Ordenar A-Z</Button>
            <Button variant="gray" className="small" onClick={() => setFiles((a) => [...a].reverse())}>Invertir orden</Button>
            <Button variant="danger" className="small" onClick={() => setFiles([])}>Quitar todos</Button>
            <span className="spacer" />
            <span className="hint">Arrastra o usa las flechas para reordenar</span>
          </div>
          <ul className="rows">
            {files.map((f, i) => {
              const r = safeRange(f)
              return (
                <li key={f.id} className="row" {...drag(i)}>
                  <span className="row-num">{i + 1}</span>
                  <div className="mini"><PdfThumb doc={f.doc} width={44} /></div>
                  <div className="row-main">
                    <b>{f.name}</b>
                    <span>{r.error ? <span style={{ color: 'var(--red)' }}>Rango no válido</span> : `${r.count} de ${f.pages} pág.`} · {fmtSize(f.size)}</span>
                  </div>
                  <input
                    value={f.range}
                    placeholder="Todas"
                    aria-label="Páginas a incluir"
                    onChange={(e) => setFiles((a) => a.map((x) => (x.id === f.id ? { ...x, range: e.target.value } : x)))}
                    style={{ width: 84, background: 'var(--fill)', border: 0, borderRadius: 8, padding: '6px 8px', textAlign: 'center', outline: r.error ? '1.5px solid var(--red)' : 0 }}
                  />
                  <IconButton icon="up" label="Subir" disabled={i === 0} onClick={() => moveItem(setFiles, i, -1)} />
                  <IconButton icon="down" label="Bajar" disabled={i === files.length - 1} onClick={() => moveItem(setFiles, i, 1)} />
                  <IconButton icon="close" label="Quitar" onClick={() => setFiles((a) => a.filter((x) => x.id !== f.id))} />
                </li>
              )
            })}
          </ul>
          <Group>
            <label className="field"><span>Nombre del archivo</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <div className="field"><span>Marcador por cada archivo<small>Añade un índice con el nombre de cada documento</small></span><Switch checked={marks} onChange={setMarks} label="Marcadores" /></div>
          </Group>
          <p className="hint">Escribe un rango (por ejemplo 1-3, 5) en un archivo para incluir solo esas páginas.</p>
        </>
      )}
      <ActionBar info={files.length ? `${files.length} archivos · ${total} páginas` : 'Añade al menos 2 PDF'}>
        <Button icon="merge" busy={t.busy} disabled={files.length < 2 || files.some((f) => safeRange(f).error)} onClick={merge}>Unir PDF</Button>
      </ActionBar>
    </div>
  )
}
