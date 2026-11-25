import { useRef, useState } from 'react'
import { PDFDocument, degrees, rgb } from 'pdf-lib'
import { ActionBar, Button, ErrorNote, Group, Pager, Result, Segmented, Switch } from '../components/ui'
import { FileCard } from '../components/PdfThumb'
import { PageView, PdfGate, usePdfInput } from '../components/PdfGate'
import { baseName, fileToPngDataUrl, hexToRgb, pdfBlob, rangeIndices, safeText } from '../lib/pdf'
import { CSS_FAM, FAMILIES, stdFont } from '../lib/fonts'

const LAYOUTS = [['center', 'Centro'], ['tile', 'Mosaico'], ['tl', 'Arriba izquierda'], ['tc', 'Arriba centro'], ['tr', 'Arriba derecha'], ['bl', 'Abajo izquierda'], ['bc', 'Abajo centro'], ['br', 'Abajo derecha']]

/** Centros (origen arriba-izquierda) donde se estampa un elemento de w×h. */
function positions(W, H, w, h, layout, margin, gap) {
  if (layout === 'center') return [{ cx: W / 2, cy: H / 2 }]
  if (layout === 'tile') {
    const sx = Math.max(10, w + gap), sy = Math.max(10, h + gap)
    const out = []
    const R = Math.ceil(H / sy) + 1, C = Math.ceil(W / sx) + 1
    for (let r = -R; r <= R; r++) for (let c = -C; c <= C; c++) {
      const cx = W / 2 + c * sx + (Math.abs(r) % 2 ? sx / 2 : 0), cy = H / 2 + r * sy
      if (cx > -w && cx < W + w && cy > -h && cy < H + h) out.push({ cx, cy })
    }
    return out
  }
  const x = layout[1] === 'l' ? margin + w / 2 : layout[1] === 'r' ? W - margin - w / 2 : W / 2
  const y = layout[0] === 't' ? margin + h / 2 : H - margin - h / 2
  return [{ cx: x, cy: y }]
}

let measureCtx
const measure = (txt, css) => { measureCtx ||= document.createElement('canvas').getContext('2d'); measureCtx.font = css; return measureCtx.measureText(txt).width }

export default function Watermark() {
  const input = usePdfInput()
  const { pdf, setPdf, t } = input
  const [kind, setKind] = useState('text')
  const [text, setText] = useState('CONFIDENCIAL')
  const [family, setFamily] = useState('sans')
  const [bold, setBold] = useState(true)
  const [italic, setItalic] = useState(false)
  const [size, setSize] = useState(64)
  const [color, setColor] = useState('#ff3b30')
  const [img, setImg] = useState(null)
  const [imgPct, setImgPct] = useState(40)
  const [opacity, setOpacity] = useState(25)
  const [rot, setRot] = useState(45)
  const [layout, setLayout] = useState('center')
  const [gap, setGap] = useState(60)
  const [margin, setMargin] = useState(30)
  const [scope, setScope] = useState('all')
  const [range, setRange] = useState('')
  const [skipFirst, setSkipFirst] = useState(false)
  const [prev, setPrev] = useState(1)
  const fileRef = useRef()

  const pickImg = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (f) try { setImg(await fileToPngDataUrl(f, 1600)) } catch { t.setError('No se pudo leer la imagen.') }
  }

  // dimensiones del elemento para una página de ancho W
  const elDims = (W, font) => {
    if (kind === 'image' && img) { const w = (W * imgPct) / 100; return { w, h: w / img.ratio } }
    const w = font ? font.widthOfTextAtSize(safeText(font, text), size) : measure(text, `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${CSS_FAM[family]}`)
    return { w, h: size * 0.7 }
  }

  const run = () =>
    t.run(async () => {
      const doc = await PDFDocument.load(pdf.bytes, { ignoreEncryption: true })
      const total = doc.getPageCount()
      const all = Array.from({ length: total }, (_, i) => i)
      let idx = scope === 'all' ? all : scope === 'odd' ? all.filter((i) => i % 2 === 0) : scope === 'even' ? all.filter((i) => i % 2 === 1) : rangeIndices(range, total)
      if (skipFirst) idx = idx.filter((i) => i !== 0)
      if (!idx.length) throw new Error('No hay páginas seleccionadas.')
      const font = kind === 'text' ? await doc.embedFont(stdFont({ family, bold, italic })) : null
      const png = kind === 'image' ? await doc.embedPng(img.dataUrl) : null
      const c = hexToRgb(color)
      const th = (rot * Math.PI) / 180
      for (const i of idx) {
        const p = doc.getPage(i)
        const { width: W, height: H } = p.getSize()
        const { w, h } = elDims(W, font)
        for (const { cx, cy } of positions(W, H, w, h, layout, margin, gap)) {
          const x = cx - ((w / 2) * Math.cos(th) - (h / 2) * Math.sin(th))
          const y = H - cy - ((w / 2) * Math.sin(th) + (h / 2) * Math.cos(th))
          if (font) p.drawText(safeText(font, text), { x, y, size, font, color: rgb(c.r, c.g, c.b), opacity: opacity / 100, rotate: degrees(rot) })
          else p.drawImage(png, { x, y, width: w, height: h, opacity: opacity / 100, rotate: degrees(rot) })
        }
      }
      return { blob: pdfBlob(await doc.save()), name: `${baseName(pdf.name)}_marca.pdf`, info: `Marca de agua en ${idx.length} ${idx.length === 1 ? 'página' : 'páginas'}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setPdf(null) }} />
  const ready = kind === 'text' ? text.trim() : !!img
  return (
    <PdfGate input={input}>
      {pdf && (
        <div className="stack">
          <div className="narrow stack" style={{ width: '100%' }}>
            <FileCard pdf={pdf} onRemove={() => setPdf(null)} />
            <Segmented value={kind} onChange={setKind} options={[{ value: 'text', label: 'Texto' }, { value: 'image', label: 'Imagen / logo' }]} />
            <Group>
              {kind === 'text' ? (
                <>
                  <label className="field"><span>Texto</span><input type="text" value={text} onChange={(e) => setText(e.target.value)} /></label>
                  <div className="field col"><span>Fuente</span><Segmented value={family} onChange={setFamily} options={FAMILIES} /></div>
                  <div className="field"><span>Negrita</span><Switch checked={bold} onChange={setBold} label="Negrita" /></div>
                  <div className="field"><span>Cursiva</span><Switch checked={italic} onChange={setItalic} label="Cursiva" /></div>
                  <label className="field"><span>Tamaño</span><input type="range" min="12" max="160" value={size} onChange={(e) => setSize(+e.target.value)} /><span className="field-val">{size}</span></label>
                  <label className="field"><span>Color</span><input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
                </>
              ) : (
                <>
                  <div className="field"><span>{img ? 'Imagen cargada' : 'Sin imagen'}</span><Button variant="tinted" className="small" onClick={() => fileRef.current.click()}>{img ? 'Cambiar' : 'Elegir imagen'}</Button></div>
                  <label className="field"><span>Tamaño<small>% del ancho de página</small></span><input type="range" min="5" max="100" value={imgPct} onChange={(e) => setImgPct(+e.target.value)} /><span className="field-val">{imgPct}%</span></label>
                </>
              )}
              <label className="field"><span>Opacidad</span><input type="range" min="5" max="100" value={opacity} onChange={(e) => setOpacity(+e.target.value)} /><span className="field-val">{opacity}%</span></label>
              <label className="field"><span>Rotación</span><input type="range" min="-90" max="90" value={rot} onChange={(e) => setRot(+e.target.value)} /><span className="field-val">{rot}°</span></label>
              <label className="field"><span>Posición</span><select value={layout} onChange={(e) => setLayout(e.target.value)}>{LAYOUTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              {layout === 'tile' && <label className="field"><span>Separación</span><input type="range" min="0" max="250" value={gap} onChange={(e) => setGap(+e.target.value)} /><span className="field-val">{gap}</span></label>}
              {!['center', 'tile'].includes(layout) && <label className="field"><span>Margen</span><input type="range" min="0" max="120" value={margin} onChange={(e) => setMargin(+e.target.value)} /><span className="field-val">{margin}</span></label>}
            </Group>
            <Group>
              <div className="field col"><span>Aplicar a</span>
                <Segmented value={scope} onChange={setScope} options={[{ value: 'all', label: 'Todas' }, { value: 'odd', label: 'Impares' }, { value: 'even', label: 'Pares' }, { value: 'range', label: 'Rango' }]} />
              </div>
              {scope === 'range' && <label className="field"><span>Rango</span><input type="text" placeholder="1-3, 5" value={range} onChange={(e) => setRange(e.target.value)} /></label>}
              <div className="field"><span>Omitir la primera página</span><Switch checked={skipFirst} onChange={setSkipFirst} label="Omitir primera" /></div>
            </Group>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImg} />
          </div>
          <div className="pageview-wrap stack">
            <Pager page={prev} total={pdf.pages} onChange={setPrev} />
            <PageView doc={pdf.doc} page={prev} scale={1.1}>
              {({ w: W, h: H }) => {
                if (!ready) return null
                const { w, h } = elDims(W)
                return (
                  <g pointerEvents="none" opacity={opacity / 100}>
                    {positions(W, H, w, h, layout, margin, gap).map((p, i) => kind === 'text'
                      ? <text key={i} x={p.cx} y={p.cy} textAnchor="middle" dominantBaseline="central" fontSize={size} fill={color} fontFamily={CSS_FAM[family]} fontWeight={bold ? 700 : 400} fontStyle={italic ? 'italic' : 'normal'} transform={`rotate(${-rot} ${p.cx} ${p.cy})`}>{text}</text>
                      : <image key={i} href={img.dataUrl} x={p.cx - w / 2} y={p.cy - h / 2} width={w} height={h} preserveAspectRatio="none" transform={`rotate(${-rot} ${p.cx} ${p.cy})`} />)}
                  </g>
                )
              }}
            </PageView>
          </div>
          <ErrorNote msg={t.error} />
          <ActionBar><Button icon="droplet" busy={t.busy} disabled={!ready} onClick={run}>Añadir marca de agua</Button></ActionBar>
        </div>
      )}
    </PdfGate>
  )
}
