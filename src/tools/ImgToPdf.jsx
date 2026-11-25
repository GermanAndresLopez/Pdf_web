import { useEffect, useRef, useState } from 'react'
import { PDFDocument } from 'pdf-lib'
import { ActionBar, Button, Dropzone, ErrorNote, Group, Icon, IconButton, Result, Segmented } from '../components/ui'
import { canvasToBlob, fmtSize, hexToRgb, pdfBlob, uid } from '../lib/pdf'
import { moveItem, useReorder, useTask } from '../lib/hooks'
import { rgb } from 'pdf-lib'

const SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008] }

/** Devuelve un canvas con la imagen girada y, si se pide, recomprimida. */
async function toCanvas(file, rot) {
  const bmp = await createImageBitmap(file)
  const swap = rot % 180 !== 0
  const c = document.createElement('canvas')
  c.width = swap ? bmp.height : bmp.width
  c.height = swap ? bmp.width : bmp.height
  const x = c.getContext('2d')
  x.translate(c.width / 2, c.height / 2)
  x.rotate((rot * Math.PI) / 180)
  x.drawImage(bmp, -bmp.width / 2, -bmp.height / 2)
  return c
}

async function embed(out, file, rot, quality) {
  if (!rot && !quality) {
    const buf = await file.arrayBuffer()
    if (file.type === 'image/jpeg') return out.embedJpg(buf)
    if (file.type === 'image/png') return out.embedPng(buf)
  }
  const c = await toCanvas(file, rot)
  if (quality) return out.embedJpg(await (await canvasToBlob(c, 'image/jpeg', quality)).arrayBuffer())
  return out.embedPng(await (await canvasToBlob(c, 'image/png')).arrayBuffer())
}

export default function ImgToPdf() {
  const [imgs, setImgs] = useState([])
  const [size, setSize] = useState('a4')
  const [orient, setOrient] = useState('auto')
  const [margin, setMargin] = useState(20)
  const [fit, setFit] = useState('contain')
  const [bg, setBg] = useState('#ffffff')
  const [quality, setQuality] = useState(0)
  const t = useTask()
  const drag = useReorder(setImgs)
  const urls = useRef(new Set())
  const cam = useRef()

  useEffect(() => () => urls.current.forEach(URL.revokeObjectURL), [])

  const add = (list) => {
    const items = list.map((file) => {
      const url = URL.createObjectURL(file)
      urls.current.add(url)
      return { id: uid(), file, url, rot: 0 }
    })
    setImgs((a) => [...a, ...items])
  }
  const rotate = (id, d) => setImgs((a) => a.map((x) => (x.id === id ? { ...x, rot: (x.rot + d + 360) % 360 } : x)))

  const run = () =>
    t.run(async () => {
      const out = await PDFDocument.create()
      const c = hexToRgb(bg)
      for (const im of imgs) {
        const img = await embed(out, im.file, im.rot, quality)
        let pw, ph
        const m = margin
        if (size === 'fit') { pw = img.width * 0.75 + m * 2; ph = img.height * 0.75 + m * 2 }
        else {
          ;[pw, ph] = SIZES[size]
          const land = orient === 'auto' ? img.width > img.height : orient === 'landscape'
          if (land) [pw, ph] = [ph, pw]
        }
        const page = out.addPage([pw, ph])
        if (bg.toLowerCase() !== '#ffffff') page.drawRectangle({ x: 0, y: 0, width: pw, height: ph, color: rgb(c.r, c.g, c.b) })
        const aw = pw - m * 2, ah = ph - m * 2
        const k = fit === 'cover' ? Math.max(aw / img.width, ah / img.height) : fit === 'stretch' ? 0 : Math.min(aw / img.width, ah / img.height)
        const w = fit === 'stretch' ? aw : img.width * k
        const h = fit === 'stretch' ? ah : img.height * k
        // "cover" recorta lo que sobra: se dibuja centrado y la página lo corta
        page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h })
      }
      const bytes = await out.save()
      return { blob: pdfBlob(bytes), name: 'imagenes.pdf', info: `${imgs.length} ${imgs.length === 1 ? 'imagen' : 'imágenes'} · ${fmtSize(bytes.length)}` }
    })

  if (t.result) return <Result result={t.result} onReset={() => { t.reset(); setImgs([]) }} />

  return (
    <div className="stack narrow">
      <Dropzone accept="image/*" multiple compact={imgs.length > 0} title={imgs.length ? 'Añadir más imágenes' : 'Selecciona imágenes'} hint="JPG, PNG, WEBP… Cada imagen será una página" onFiles={add} />
      <Button variant="tinted" onClick={() => cam.current.click()}><Icon name="camera" size={18} />Hacer una foto con la cámara</Button>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { if (e.target.files.length) add([...e.target.files]); e.target.value = '' }} />
      <ErrorNote msg={t.error} />
      {imgs.length > 0 && (
        <>
          <div className="toolrow"><span className="hint">Arrastra o usa las flechas para reordenar</span><span className="spacer" /><Button variant="danger" className="small" onClick={() => setImgs([])}>Quitar todas</Button></div>
          <ul className="rows">
            {imgs.map((im, i) => (
              <li key={im.id} className="row" {...drag(i)}>
                <span className="row-num">{i + 1}</span>
                <div className="mini sq"><img src={im.url} alt="" style={{ transform: `rotate(${im.rot}deg)`, transition: 'transform .3s var(--ease)' }} /></div>
                <div className="row-main"><b>{im.file.name}</b><span>{fmtSize(im.file.size)}</span></div>
                <IconButton icon="rotateL" label="Girar a la izquierda" onClick={() => rotate(im.id, -90)} />
                <IconButton icon="rotate" label="Girar a la derecha" onClick={() => rotate(im.id, 90)} />
                <IconButton icon="up" label="Subir" disabled={i === 0} onClick={() => moveItem(setImgs, i, -1)} />
                <IconButton icon="down" label="Bajar" disabled={i === imgs.length - 1} onClick={() => moveItem(setImgs, i, 1)} />
                <IconButton icon="close" label="Quitar" onClick={() => setImgs((a) => a.filter((x) => x.id !== im.id))} />
              </li>
            ))}
          </ul>
          <Group>
            <div className="field col"><span>Tamaño de página</span><Segmented value={size} onChange={setSize} options={[{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Carta' }, { value: 'legal', label: 'Legal' }, { value: 'fit', label: 'Como la imagen' }]} /></div>
            {size !== 'fit' && <div className="field col"><span>Orientación</span><Segmented value={orient} onChange={setOrient} options={[{ value: 'auto', label: 'Automática' }, { value: 'portrait', label: 'Vertical' }, { value: 'landscape', label: 'Horizontal' }]} /></div>}
            <div className="field col"><span>Margen</span><Segmented value={margin} onChange={setMargin} options={[{ value: 0, label: 'Sin margen' }, { value: 20, label: 'Pequeño' }, { value: 40, label: 'Grande' }]} /></div>
            {size !== 'fit' && <div className="field col"><span>Ajuste de la imagen</span><Segmented value={fit} onChange={setFit} options={[{ value: 'contain', label: 'Completa' }, { value: 'cover', label: 'Rellenar' }, { value: 'stretch', label: 'Estirar' }]} /></div>}
            <div className="field col"><span>Compresión<small>Reduce el tamaño del PDF recomprimiendo las imágenes</small></span><Segmented value={quality} onChange={setQuality} options={[{ value: 0, label: 'Original' }, { value: 0.9, label: 'Alta' }, { value: 0.7, label: 'Media' }, { value: 0.5, label: 'Baja' }]} /></div>
            <label className="field"><span>Color de fondo</span><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></label>
          </Group>
        </>
      )}
      <ActionBar info={imgs.length ? `${imgs.length} imágenes` : 'Añade al menos una imagen'}>
        <Button icon="image" busy={t.busy} disabled={!imgs.length} onClick={run}>Crear PDF</Button>
      </ActionBar>
    </div>
  )
}
