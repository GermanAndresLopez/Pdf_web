import { useEffect, useRef, useState } from 'react'
import { renderPage, fmtSize } from '../lib/pdf'
import { IconButton } from './ui'

/** Miniatura de una página; se renderiza solo cuando es visible. */
export default function PdfThumb({ doc, page = 1, width = 160, rotation = 0 }) {
  const ref = useRef()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setVisible(true), io.disconnect()), { rootMargin: '200px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let dead = false
    renderPage(doc, page, { width: width * Math.min(2, window.devicePixelRatio || 1) })
      .then((c) => {
        if (dead || !ref.current) return
        c.style.width = '100%'
        c.style.height = 'auto'
        ref.current.replaceChildren(c)
      })
      .catch(() => {})
    return () => { dead = true }
  }, [visible, doc, page, width])

  const odd = Math.abs(rotation) % 180 === 90
  return (
    <div
      ref={ref}
      className="thumb"
      style={{
        width: '100%',
        aspectRatio: '1 / 1.414',
        transform: rotation ? `rotate(${rotation}deg) scale(${odd ? 0.72 : 1})` : undefined,
      }}
    />
  )
}

export function FileCard({ pdf, onRemove }) {
  return (
    <div className="file-card">
      <div className="mini"><PdfThumb doc={pdf.doc} width={52} /></div>
      <div className="row-main">
        <b>{pdf.name}</b>
        <span>{pdf.pages} {pdf.pages === 1 ? 'página' : 'páginas'} · {fmtSize(pdf.size)}</span>
      </div>
      {onRemove && <IconButton icon="close" label="Quitar archivo" onClick={onRemove} />}
    </div>
  )
}
