import { useRef, useState } from 'react'
import mammoth from 'mammoth/mammoth.browser'
import { ActionBar, Button, ErrorNote, Group, Icon, Result, Segmented, Switch } from '../components/ui'
import { fmtSize, pdfBlob } from '../lib/pdf'
import { escapeHtml, htmlToPdf } from '../lib/html'
import { useTask } from '../lib/hooks'

const CMDS = [
  ['bold', 'B', 'Negrita', { fontWeight: 800 }],
  ['italic', 'I', 'Cursiva', { fontStyle: 'italic' }],
  ['underline', 'U', 'Subrayado', { textDecoration: 'underline' }],
  ['formatBlock:H1', 'H1', 'Título 1'],
  ['formatBlock:H2', 'H2', 'Título 2'],
  ['formatBlock:P', '¶', 'Párrafo'],
  ['insertUnorderedList', '•', 'Lista con viñetas'],
  ['insertOrderedList', '1.', 'Lista numerada'],
  ['justifyLeft', '⇤', 'Alinear a la izquierda'],
  ['justifyCenter', '↔', 'Centrar'],
  ['justifyRight', '⇥', 'Alinear a la derecha'],
]

export default function TextToPdf() {
  const [mode, setMode] = useState('rich')
  const [plain, setPlain] = useState('')
  const [html, setHtml] = useState('')
  const [richInit, setRichInit] = useState('')
  const [richKey, setRichKey] = useState(0)
  const [size, setSize] = useState('a4')
  const [landscape, setLandscape] = useState(false)
  const [margin, setMargin] = useState(56)
  const [font, setFont] = useState('sans')
  const [fontSize, setFontSize] = useState(14)
  const [lh, setLh] = useState(1.55)
  const [selectable, setSelectable] = useState(true)
  const rich = useRef()
  const file = useRef()
  const t = useTask()

  const exec = (c) => {
    const [cmd, val] = c.split(':')
    rich.current?.focus()
    document.execCommand(cmd, false, val)
  }

  const content = () => (mode === 'rich' ? rich.current?.innerHTML || '' : mode === 'html' ? html : `<div style="white-space:pre-wrap">${escapeHtml(plain)}</div>`)
  const hasText = () => (mode === 'rich' ? !!rich.current?.innerText.trim() : mode === 'html' ? !!html.trim() : !!plain.trim())

  const importFile = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    t.run(async () => {
      const n = f.name.toLowerCase()
      if (n.endsWith('.docx')) {
        const { value } = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() })
        setRichInit(value); setRichKey((k) => k + 1); setMode('rich')
      } else if (n.endsWith('.html') || n.endsWith('.htm')) { setHtml(await f.text()); setMode('html') }
      else { setPlain(await f.text()); setMode('plain') }
    })
  }

  const run = () =>
    t.run(async () => {
      if (!hasText()) throw new Error('Escribe algo de texto primero.')
      const bytes = await htmlToPdf(content(), { pageSize: size, landscape, margin, font, fontSize, lineHeight: lh, selectable })
      return { blob: pdfBlob(bytes), name: 'documento.pdf', info: `PDF generado · ${fmtSize(bytes.length)}` }
    })

  if (t.result) return <Result result={t.result} onReset={t.reset} resetLabel="Seguir editando" />

  return (
    <div className="stack narrow">
      <div className="toolrow" style={{ justifyContent: 'space-between' }}>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'rich', label: 'Editor' }, { value: 'plain', label: 'Texto plano' }, { value: 'html', label: 'HTML' }]} />
        <Button variant="gray" className="small" onClick={() => file.current.click()}><Icon name="upload" size={16} />Importar archivo</Button>
        <input ref={file} type="file" accept=".txt,.md,.html,.htm,.docx" hidden onChange={importFile} />
      </div>
      <div className="group" style={{ overflow: 'hidden' }}>
        {mode === 'rich' && (
          <>
            <div className="rich-bar">
              {CMDS.map(([c, label, title, style]) => (
                <button key={c} className="icon-btn" title={title} aria-label={title} style={{ width: 'auto', minWidth: 36, borderRadius: 10, padding: '0 8px', fontSize: 14, fontWeight: 600, ...style }} onMouseDown={(e) => { e.preventDefault(); exec(c) }}>{label}</button>
              ))}
            </div>
            <div key={richKey} ref={rich} className="rich" contentEditable suppressContentEditableWarning data-ph="Escribe o pega tu texto aquí…" dangerouslySetInnerHTML={{ __html: richInit }} />
          </>
        )}
        {mode === 'plain' && <label className="field col"><textarea value={plain} onChange={(e) => setPlain(e.target.value)} placeholder="Escribe o pega tu texto aquí…" /></label>}
        {mode === 'html' && <label className="field col"><textarea value={html} onChange={(e) => setHtml(e.target.value)} placeholder={'<h1>Título</h1>\n<p>Escribe o pega tu HTML aquí…</p>'} style={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 14 }} /></label>}
      </div>
      <Group>
        <div className="field col"><span>Tamaño de página</span><Segmented value={size} onChange={setSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Carta' }, { value: 'legal', label: 'Legal' }]} /></div>
        <div className="field col"><span>Orientación</span><Segmented value={landscape} onChange={setLandscape} options={[{ value: false, label: 'Vertical' }, { value: true, label: 'Horizontal' }]} /></div>
        <div className="field col"><span>Márgenes</span><Segmented value={margin} onChange={setMargin} options={[{ value: 30, label: 'Estrechos' }, { value: 56, label: 'Normales' }, { value: 80, label: 'Amplios' }]} /></div>
        <div className="field col"><span>Fuente</span><Segmented value={font} onChange={setFont} options={[{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]} /></div>
        <label className="field"><span>Tamaño de letra</span><input type="range" min="10" max="24" value={fontSize} onChange={(e) => setFontSize(+e.target.value)} /><span className="field-val">{fontSize}</span></label>
        <div className="field col"><span>Interlineado</span><Segmented value={lh} onChange={setLh} options={[{ value: 1.25, label: 'Compacto' }, { value: 1.55, label: 'Normal' }, { value: 2, label: 'Amplio' }]} /></div>
        <div className="field"><span>Texto buscable y copiable</span><Switch checked={selectable} onChange={setSelectable} label="Texto buscable" /></div>
      </Group>
      <ErrorNote msg={t.error} />
      <ActionBar><Button icon="text" busy={t.busy} onClick={run}>Crear PDF</Button></ActionBar>
    </div>
  )
}
