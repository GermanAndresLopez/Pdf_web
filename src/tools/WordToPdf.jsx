import { useState } from 'react'
import mammoth from 'mammoth/mammoth.browser'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, Group, IconButton, Progress, Result, Segmented, Switch } from '../components/ui'
import { baseName, fmtSize, pdfBlob, uid, zipBlobs } from '../lib/pdf'
import { htmlToPdf } from '../lib/html'
import { useTask } from '../lib/hooks'

export default function WordToPdf() {
  const [files, setFiles] = useState([])
  const [size, setSize] = useState('a4')
  const [landscape, setLandscape] = useState(false)
  const [margin, setMargin] = useState(56)
  const [fontSize, setFontSize] = useState(14)
  const [font, setFont] = useState('serif')
  const [selectable, setSelectable] = useState(true)
  const [merge, setMerge] = useState(false)
  const [warns, setWarns] = useState([])
  const [prog, setProg] = useState(0)
  const t = useTask()

  const add = (list) => {
    const ok = list.filter((f) => f.name.toLowerCase().endsWith('.docx'))
    if (ok.length < list.length) t.setError('Los archivos .doc antiguos no se pueden abrir: ábrelos en Word y guárdalos como .docx.')
    setFiles((a) => [...a, ...ok.map((file) => ({ id: uid(), file }))])
  }

  const run = () =>
    t.run(async () => {
      const results = []
      const messages = new Set()
      for (const [i, { file }] of files.entries()) {
        const { value: html, messages: m } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() })
        m.forEach((x) => messages.add(x.message))
        if (!html.trim()) throw new Error(`«${file.name}» parece estar vacío.`)
        results.push({ name: `${baseName(file.name)}.pdf`, bytes: await htmlToPdf(html, { pageSize: size, landscape, margin, fontSize, font, selectable }) })
        setProg((i + 1) / files.length)
      }
      setWarns([...messages].slice(0, 5))
      if (results.length === 1) return { blob: pdfBlob(results[0].bytes), name: results[0].name, info: `PDF generado · ${fmtSize(results[0].bytes.length)}` }
      if (merge) {
        const out = await PDFDocument.create()
        for (const r of results) { const d = await PDFDocument.load(r.bytes); (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p)) }
        const bytes = await out.save()
        return { blob: pdfBlob(bytes), name: 'documentos.pdf', info: `${results.length} documentos unidos · ${out.getPageCount()} páginas` }
      }
      return { blob: await zipBlobs(results.map((r) => ({ name: r.name, blob: pdfBlob(r.bytes) }))), name: 'documentos_pdf.zip', info: `${results.length} PDF dentro de un ZIP` }
    })

  const reset = () => { t.reset(); setFiles([]); setWarns([]) }
  if (t.result) return (
    <div className="stack narrow">
      <Result result={t.result} onReset={reset} />
      {warns.length > 0 && <div className="note">Avisos de la conversión: {warns.join(' · ')}</div>}
    </div>
  )
  return (
    <div className="stack narrow">
      <Dropzone accept=".docx" multiple compact={files.length > 0} title={files.length ? 'Añadir más documentos' : 'Selecciona documentos de Word'} hint="Formato .docx · puedes elegir varios" onFiles={(l) => { t.reset(); add(l) }} />
      <ErrorNote msg={t.error} />
      {files.length > 0 && (
        <>
          <ul className="rows">
            {files.map((f) => (
              <li key={f.id} className="row" style={{ cursor: 'default' }}>
                <div className="row-main"><b>{f.file.name}</b><span>{fmtSize(f.file.size)}</span></div>
                <IconButton icon="close" label="Quitar" onClick={() => setFiles((a) => a.filter((x) => x.id !== f.id))} />
              </li>
            ))}
          </ul>
          <Group>
            <div className="field col"><span>Tamaño de página</span><Segmented value={size} onChange={setSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Carta' }, { value: 'legal', label: 'Legal' }]} /></div>
            <div className="field col"><span>Orientación</span><Segmented value={landscape} onChange={setLandscape} options={[{ value: false, label: 'Vertical' }, { value: true, label: 'Horizontal' }]} /></div>
            <div className="field col"><span>Márgenes</span><Segmented value={margin} onChange={setMargin} options={[{ value: 30, label: 'Estrechos' }, { value: 56, label: 'Normales' }, { value: 80, label: 'Amplios' }]} /></div>
            <div className="field col"><span>Fuente base</span><Segmented value={font} onChange={setFont} options={[{ value: 'serif', label: 'Serif' }, { value: 'sans', label: 'Sans' }, { value: 'mono', label: 'Mono' }]} /></div>
            <label className="field"><span>Tamaño de letra</span><input type="range" min="10" max="20" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} /><span className="field-val">{fontSize}</span></label>
            <div className="field"><span>Texto buscable y copiable<small>Añade una capa de texto invisible</small></span><Switch checked={selectable} onChange={setSelectable} label="Texto buscable" /></div>
            {files.length > 1 && <div className="field"><span>Unir todo en un solo PDF</span><Switch checked={merge} onChange={setMerge} label="Unir" /></div>}
          </Group>
          <div className="note">Se conservan títulos, párrafos, listas, tablas e imágenes. Los diseños muy elaborados (columnas, cuadros de texto, encabezados y pies) pueden variar un poco.</div>
          {t.busy && <Progress value={prog} label={`Convirtiendo… ${Math.round(prog * 100)}%`} />}
        </>
      )}
      <ActionBar info={files.length ? `${files.length} ${files.length === 1 ? 'documento' : 'documentos'}` : ''}><Button icon="word" busy={t.busy} disabled={!files.length} onClick={run}>Convertir a PDF</Button></ActionBar>
    </div>
  )
}
