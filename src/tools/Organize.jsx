import { useRef, useState } from 'react'
import { PDFDocument, degrees } from 'pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, Icon, IconButton, Result } from '../components/ui'
import PdfThumb from '../components/PdfThumb'
import { baseName, loadPdf, pdfBlob, uid } from '../lib/pdf'
import { useReorder, useTask } from '../lib/hooks'

export default function Organize() {
  const [pdf, setPdf] = useState(null)
  const [pages, setPages] = useState([])
  const [sel, setSel] = useState(new Set())
  const srcs = useRef({}) // id → PDF cargado (el principal y los insertados)
  const hist = useRef([])
  const more = useRef()
  const t = useTask()
  const drag = useReorder((fn) => { hist.current.push(pages); setPages(fn) })

  const apply = (fn) => { hist.current.push(pages); setPages(fn) }
  const undo = () => { const p = hist.current.pop(); if (p) { setPages(p); setSel(new Set()) } }

  const open = (f) =>
    t.run(async () => {
      const p = await loadPdf(f[0])
      srcs.current = { [p.id]: p }
      hist.current = []
      setPdf(p)
      setSel(new Set())
      setPages(Array.from({ length: p.pages }, (_, i) => ({ id: uid(), src: p.id, n: i + 1, rot: 0 })))
    })

  // posición de inserción: justo después de la última página seleccionada, o al final
  const insertAt = () => {
    const idx = pages.map((p, i) => (sel.has(p.id) ? i : -1)).filter((i) => i >= 0)
    return idx.length ? Math.max(...idx) + 1 : pages.length
  }

  const insertFromPdf = (files) =>
    t.run(async () => {
      const p = await loadPdf(files[0])
      srcs.current[p.id] = p
      const at = insertAt()
      const items = Array.from({ length: p.pages }, (_, i) => ({ id: uid(), src: p.id, n: i + 1, rot: 0 }))
      apply((a) => [...a.slice(0, at), ...items, ...a.slice(at)])
    })

  const addBlank = async () => {
    const vp = (await pdf.doc.getPage(1)).getViewport({ scale: 1 })
    const at = insertAt()
    apply((a) => [...a.slice(0, at), { id: uid(), blank: { w: vp.width, h: vp.height }, rot: 0 }, ...a.slice(at)])
  }

  const rotate = (ids, d) => apply((a) => a.map((p) => (ids.has(p.id) ? { ...p, rot: p.rot + d } : p)))
  const remove = (ids) => { apply((a) => a.filter((p) => !ids.has(p.id))); setSel(new Set()) }
  const duplicate = (ids) => apply((a) => a.flatMap((p) => (ids.has(p.id) ? [p, { ...p, id: uid() }] : [p])))
  const toggle = (id) => setSel((s) => { const c = new Set(s); c.has(id) ? c.delete(id) : c.add(id); return c })

  const save = () =>
    t.run(async () => {
      const out = await PDFDocument.create()
      const docs = {}
      for (const p of pages) {
        if (p.blank) {
          const page = out.addPage([p.blank.w, p.blank.h])
          page.setRotation(degrees(((p.rot % 360) + 360) % 360))
          continue
        }
        const d = (docs[p.src] ||= await PDFDocument.load(srcs.current[p.src].bytes, { ignoreEncryption: true }))
        const [cp] = await out.copyPages(d, [p.n - 1])
        cp.setRotation(degrees((((cp.getRotation().angle + p.rot) % 360) + 360) % 360))
        out.addPage(cp)
      }
      return { blob: pdfBlob(await out.save()), name: `${baseName(pdf.name)}_organizado.pdf`, info: `${pages.length} páginas` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null); setPages([]) }} />
  if (!pdf) return (
    <div className="stack narrow">
      <Dropzone accept=".pdf,application/pdf" busy={t.busy} title="Selecciona un PDF" onFiles={open} />
      <ErrorNote msg={t.error} />
    </div>
  )

  const all = new Set(pages.map((p) => p.id))
  const target = sel.size ? sel : null
  return (
    <div className="stack">
      <div className="toolrow">
        <Button variant="gray" className="small" onClick={() => setSel(sel.size === pages.length ? new Set() : all)}>{sel.size === pages.length ? 'Ninguna' : 'Seleccionar todas'}</Button>
        <Button variant="tinted" className="small" icon="rotateL" disabled={!target} onClick={() => rotate(target, -90)}>Girar</Button>
        <Button variant="tinted" className="small" icon="rotate" disabled={!target} onClick={() => rotate(target, 90)}>Girar</Button>
        <Button variant="tinted" className="small" icon="copy" disabled={!target} onClick={() => duplicate(target)}>Duplicar</Button>
        <Button variant="danger" className="small" icon="trash" disabled={!target || sel.size === pages.length} onClick={() => remove(target)}>Eliminar</Button>
        <span className="spacer" />
        <Button variant="gray" className="small" icon="pagePlus" onClick={addBlank}>Página en blanco</Button>
        <Button variant="gray" className="small" icon="plus" onClick={() => more.current.click()}>Insertar PDF</Button>
        <Button variant="gray" className="small" onClick={() => apply((a) => [...a].reverse())}>Invertir</Button>
        <IconButton icon="undo" label="Deshacer" disabled={!hist.current.length} onClick={undo} />
      </div>
      <input ref={more} type="file" accept=".pdf,application/pdf" hidden onChange={(e) => { if (e.target.files[0]) insertFromPdf([e.target.files[0]]); e.target.value = '' }} />
      <p className="hint">{sel.size ? `${sel.size} seleccionadas. Las nuevas páginas se insertan después de la última seleccionada.` : 'Toca las páginas para seleccionarlas o arrástralas para reordenar.'}</p>
      <div className="pages">
        {pages.map((p, i) => (
          <div key={p.id} className={`page-card ${sel.has(p.id) ? 'sel on' : ''}`} style={{ '--i': i % 12, border: sel.has(p.id) ? '2px solid var(--blue)' : '2px solid transparent' }} {...drag(i)}>
            <div className="thumb-box" onClick={() => toggle(p.id)} style={{ cursor: 'pointer', position: 'relative' }}>
              {p.blank
                ? <div className="thumb" style={{ width: '70%', aspectRatio: `${p.blank.w} / ${p.blank.h}`, transform: p.rot ? `rotate(${p.rot}deg)` : undefined }} />
                : <PdfThumb doc={srcs.current[p.src].doc} page={p.n} width={150} rotation={p.rot} />}
              {sel.has(p.id) && <span className="badge" style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="check" size={13} stroke={3} /></span>}
            </div>
            <footer>
              <span>{i + 1}{p.blank ? ' · en blanco' : p.src !== pdf.id ? ' · insertada' : ''}</span>
              <span style={{ display: 'flex', gap: 2 }}>
                <IconButton className="plain" icon="rotateL" label="Girar a la izquierda" onClick={() => rotate(new Set([p.id]), -90)} />
                <IconButton className="plain" icon="rotate" label="Girar a la derecha" onClick={() => rotate(new Set([p.id]), 90)} />
                <IconButton className="plain" icon="trash" label="Eliminar página" disabled={pages.length === 1} onClick={() => remove(new Set([p.id]))} />
              </span>
            </footer>
          </div>
        ))}
      </div>
      <ErrorNote msg={t.error} />
      <ActionBar info={`${pages.length} páginas`}>
        <Button variant="gray" onClick={() => setPdf(null)}>Cambiar archivo</Button>
        <Button icon="organize" busy={t.busy} onClick={save}>Guardar PDF</Button>
      </ActionBar>
    </div>
  )
}
