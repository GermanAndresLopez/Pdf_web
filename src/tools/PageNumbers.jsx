import { useState } from 'react'
import { PDFDocument, rgb } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Pager, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PageView, PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, hexToRgb, pdfBlob, rangeIndices, safeText, todayStr, toLetters, toRoman } from '../lib/pdf'
import { CSS_FAM, FAMILIES, stdFont } from '../lib/fonts'

const PRESETS = ['{n}', 'Página {n}', '{n} / {total}', 'Página {n} de {total}', '- {n} -', '{archivo} · {n}', '{fecha} · {n}']
const STYLES = [['num', '1, 2, 3'], ['romanU', 'I, II, III'], ['romanL', 'i, ii, iii'], ['letU', 'A, B, C'], ['letL', 'a, b, c']]
const POSITIONS = [['bc', 'Abajo, centro'], ['br', 'Abajo, derecha'], ['bl', 'Abajo, izquierda'], ['tc', 'Arriba, centro'], ['tr', 'Arriba, derecha'], ['tl', 'Arriba, izquierda']]

const fmtNum = (n, style, pad) =>
  style === 'romanU' ? toRoman(n) : style === 'romanL' ? toRoman(n, true) : style === 'letU' ? toLetters(n, true) : style === 'letL' ? toLetters(n) : String(n).padStart(pad, '0')

let mctx
const measure = (s, css) => { mctx ||= document.createElement('canvas').getContext('2d'); mctx.font = css; return mctx.measureText(s).width }

export default function PageNumbers() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [fmt, setFmt] = useState('Página {n} de {total}')
  const [style, setStyle] = useState('num')
  const [pad, setPad] = useState(0)
  const [pos, setPos] = useState('bc')
  const [mirror, setMirror] = useState(false)
  const [family, setFamily] = useState('sans')
  const [bold, setBold] = useState(false)
  const [size, setSize] = useState(11)
  const [margin, setMargin] = useState(30)
  const [color, setColor] = useState('#333333')
  const [start, setStart] = useState(1)
  const [from, setFrom] = useState(1)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [prev, setPrev] = useState(1)

  const label = (i, total) => {
    const n = start + (i - (from - 1))
    const last = start + (total - from)
    return fmt.replaceAll('{n}', fmtNum(n, style, pad)).replaceAll('{total}', fmtNum(last, style, pad)).replaceAll('{archivo}', pdf ? baseName(pdf.name) : '').replaceAll('{fecha}', todayStr())
  }
  const place = (i) => (mirror && i % 2 === 1 ? pos.replace(/[lr]/, (c) => (c === 'l' ? 'r' : 'l')) : pos)
  const xOf = (p, W, w) => (p[1] === 'l' ? margin : p[1] === 'r' ? W - margin - w : (W - w) / 2)

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const font = await doc.embedFont(stdFont({ family, bold }))
      const pages = doc.getPages()
      const total = pages.length
      const all = pages.map((_, i) => i)
      const inScope = new Set(scope === 'all' ? all : scope === 'odd' ? all.filter((i) => i % 2 === 0) : scope === 'even' ? all.filter((i) => i % 2 === 1) : rangeIndices(range, total))
      const c = hexToRgb(color)
      let count = 0
      pages.forEach((p, i) => {
        if (i < from - 1 || !inScope.has(i)) return
        const txt = safeText(font, label(i, total))
        const { width: W, height: H } = p.getSize()
        const w = font.widthOfTextAtSize(txt, size)
        const where = place(i)
        p.drawText(txt, { x: xOf(where, W, w), y: where[0] === 'b' ? margin : H - margin - size, size, font, color: rgb(c.r, c.g, c.b) })
        count++
      })
      if (!count) throw new Error('No hay páginas que numerar con esos ajustes.')
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_numerado.pdf`, info: `${count} páginas numeradas` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack">
          <div className="narrow stack" style={{ width: '100%' }}>
            <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
            <Group>
              <label className="field"><span>Texto<small>Usa {'{n}'}, {'{total}'}, {'{archivo}'} y {'{fecha}'}</small></span><input type="text" value={fmt} onChange={(e) => setFmt(e.target.value)} /></label>
              <div className="field"><span>Plantillas</span>
                <select value="" onChange={(e) => e.target.value && setFmt(e.target.value)}>
                  <option value="">Elegir…</option>
                  {PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <label className="field"><span>Estilo de número</span><select value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {style === 'num' && <label className="field"><span>Rellenar con ceros<small>Ej. 001, 002…</small></span><select value={pad} onChange={(e) => setPad(+e.target.value)}>{[0, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n ? `${n} dígitos` : 'No'}</option>)}</select></label>}
            </Group>
            <Group>
              <label className="field"><span>Posición</span><select value={pos} onChange={(e) => setPos(e.target.value)}>{POSITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {pos[1] !== 'c' && <div className="field"><span>Alternar en páginas pares<small>Para impresión a doble cara</small></span><Switch checked={mirror} onChange={setMirror} label="Alternar" /></div>}
              <label className="field"><span>Margen</span><input type="range" min="10" max="100" value={margin} onChange={(e) => setMargin(+e.target.value)} /><span className="field-val">{margin}</span></label>
              <div className="field col"><span>Fuente</span><Segmented value={family} onChange={setFamily} options={FAMILIES} /></div>
              <div className="field"><span>Negrita</span><Switch checked={bold} onChange={setBold} label="Negrita" /></div>
              <label className="field"><span>Tamaño</span><input type="range" min="7" max="28" value={size} onChange={(e) => setSize(+e.target.value)} /><span className="field-val">{size}</span></label>
              <label className="field"><span>Color</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
            </Group>
            <Group>
              <label className="field"><span>Número inicial</span><input type="number" min="0" value={start} onChange={(e) => setStart(Math.max(0, +e.target.value || 0))} /></label>
              <label className="field"><span>Empezar a numerar en la página</span><input type="number" min="1" max={pdf.pages} value={from} onChange={(e) => setFrom(Math.min(pdf.pages, Math.max(1, +e.target.value || 1)))} /></label>
              <div className="field col"><span>Aplicar a</span>
                <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'odd', label: 'Impares' }, { value: 'even', label: 'Pares' }, { value: 'range', label: 'Rango' }]} />
              </div>
              {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
            </Group>
          </div>
          <div className="pageview-wrap stack">
            <Pager page={prev} total={pdf.pages} onChange={setPrev} />
            <PageView doc={pdf.doc} page={prev} scale={1.1}>
              {({ w: W, h: H }) => {
                const i = prev - 1
                if (i < from - 1) return null
                const txt = label(i, pdf.pages)
                const w = measure(txt, `${bold ? 'bold ' : ''}${size}px ${CSS_FAM[family]}`)
                const where = place(i)
                return <text pointerEvents="none" x={xOf(where, W, w)} y={where[0] === 'b' ? H - margin : margin + size} fontSize={size} fill={color} fontFamily={CSS_FAM[family]} fontWeight={bold ? 700 : 400}>{txt}</text>
              }}
            </PageView>
          </div>
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="hash" busy={t.busy} onClick={run}>Añadir números</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
