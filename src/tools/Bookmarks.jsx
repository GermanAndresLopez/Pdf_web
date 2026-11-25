import { useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, IconButton, Result } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, pdfBlob, uid } from '../lib/pdf'
import { pageRuns } from '../lib/runs'
import { setOutline } from '../lib/outline'

export default function Bookmarks() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [items, setItems] = useState([])
  const [detecting, setDetecting] = useState(false)

  const upd = (id, patch) => setItems((a) => a.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const detect = async () => {
    setDetecting(true)
    try {
      const all = []
      for (let n = 1; n <= Math.min(pdf.pages, 300); n++) {
        const { runs } = await pageRuns(pdf.doc, n)
        runs.forEach((r) => all.push({ ...r, page: n }))
      }
      const sizes = all.map((r) => r.size).sort((a, b) => a - b)
      const body = sizes[Math.floor(sizes.length / 2)] || 12
      const heads = all.filter((r) => r.size >= body * 1.3 && r.str.trim().length > 2 && r.str.length < 110).slice(0, 200)
      const big = [...new Set(heads.map((h) => Math.round(h.size)))].sort((a, b) => b - a)
      setItems(heads.map((h) => ({ id: uid(), title: h.str.trim(), page: h.page, level: Math.min(2, big.indexOf(Math.round(h.size))) })))
      if (!heads.length) t.setError('No se detectaron títulos. Puedes añadir los marcadores a mano.')
    } finally {
      setDetecting(false)
    }
  }

  const run = () =>
    t.run(async () => {
      const list = items.filter((i) => i.title.trim())
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      setOutline(doc, list.map((i) => ({ title: i.title.trim(), page: i.page, level: i.level })))
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_indice.pdf`, info: list.length ? `${list.length} marcadores añadidos` : 'Marcadores eliminados' }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setItems([]) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack narrow">
          <FileCard pdf={pdf} onRemove={() => { setPdf(null); setItems([]) }} />
          <div className="toolrow">
            <Button variant="tinted" className="small" icon="plus" onClick={() => setItems((a) => [...a, { id: uid(), title: '', page: 1, level: 0 }])}>Añadir marcador</Button>
            <Button variant="gray" className="small" icon="search" busy={detecting} onClick={detect}>Detectar títulos</Button>
            {items.length > 0 && <Button variant="danger" className="small" onClick={() => setItems([])}>Vaciar</Button>}
          </div>
          {items.length > 0 && (
            <ul className="rows">
              {items.map((it) => (
                <li key={it.id} className="row" style={{ paddingLeft: 14 + it.level * 22, cursor: 'default' }}>
                  <input
                    value={it.title}
                    placeholder="Título del marcador"
                    onChange={(e) => upd(it.id, { title: e.target.value })}
                    style={{ flex: 1, minWidth: 150, background: 'transparent', border: 0, outline: 0 }}
                  />
                  <input
                    type="number" min="1" max={pdf.pages} value={it.page} aria-label="Página"
                    onChange={(e) => upd(it.id, { page: Math.min(pdf.pages, Math.max(1, +e.target.value || 1)) })}
                    style={{ width: 56, background: 'var(--fill)', border: 0, borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}
                  />
                  <IconButton icon="left" label="Subir nivel" disabled={it.level === 0} onClick={() => upd(it.id, { level: it.level - 1 })} />
                  <IconButton icon="right" label="Bajar nivel" disabled={it.level >= 3} onClick={() => upd(it.id, { level: it.level + 1 })} />
                  <IconButton icon="close" label="Quitar" onClick={() => setItems((a) => a.filter((x) => x.id !== it.id))} />
                </li>
              ))}
            </ul>
          )}
          <div className="note">Los marcadores aparecen en el panel lateral del lector y permiten saltar a cada sección. Si el PDF ya tenía índice, se reemplaza. Para quitarlo todo, guarda sin marcadores.</div>
          <ErrorNote msg={t.error} />
          <ActionBar info={`${items.filter((i) => i.title.trim()).length} marcadores`}><Button icon="bookmark" busy={t.busy} onClick={run}>Guardar marcadores</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
