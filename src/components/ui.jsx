import { useEffect, useRef, useState } from 'react'
import { saveAs } from '../lib/pdf'

const PATHS = {
  upload: 'M12 16V4m0 0L7 9m5-5 5 5M4 20h16',
  download: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  merge: 'M8 8h11v12H8zM5 16H4V4h11v1',
  split: 'M12 3v18M7 8 3 12l4 4M17 8l4 4-4 4',
  organize: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  rotateL: 'M4 11a8 8 0 1 1 2.3 5.7M4 4v7h7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  droplet: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  hash: 'M5 9h14M5 15h14M10 4 8 20M16 4l-2 16',
  compress: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5h.01',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  text: 'M5 6V4h14v2M12 4v16M9 20h6',
  close: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'm6 15 6-6 6 6',
  down: 'm6 9 6 6 6-6',
  left: 'm15 6-6 6 6 6',
  right: 'm9 6 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  check: 'm5 12 5 5 9-10',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  pen: 'M3 17c3-6 5-6 7-2s4 3 7-5',
  highlight: 'M14 4l6 6-9 9-6-6zM5 19h6',
  signature: 'M3 16c2-6 4-8 5-6s-2 7 0 7 3-5 5-5 1 3 3 3 3-2 5-2M3 21h18',
  cursor: 'M5 3l14 7-6 2-2 6z',
  word: 'M4 4h16v16H4zM8 9l1.5 6L12 10l2.5 5L16 9',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  unlock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 7.5-2',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  scan: 'M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16',
  table: 'M4 5h16v14H4zM4 10h16M4 15h16M10 5v14',
  slides: 'M3 4h18v12H3zM12 16v4M8 20h8',
  compare: 'M4 4h7v16H4zM13 4h7v16h-7z',
  eraser: 'M4 16 14 6l6 6-8 8H8zM9 11l6 6',
  redact: 'M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM4 4l16 16',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01',
  paperclip: 'M20 11 12 19a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  camera: 'M4 7h3l2-3h6l2 3h3v13H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  rect: 'M4 6h16v12H4z',
  ellipse: 'M12 5c5 0 9 3 9 7s-4 7-9 7-9-3-9-7 4-7 9-7z',
  line: 'M5 19 19 5',
  arrow: 'M5 19 19 5M9 5h10v10',
  underline: 'M7 4v7a5 5 0 0 0 10 0V4M5 20h14',
  strike: 'M5 12h14M16 7a4 4 0 0 0-4-2c-2.5 0-4 1-4 3s2 3 4 3 4 1 4 3-1.5 3-4 3a4 4 0 0 1-4-2',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  wrench: 'M14.5 6.5a4 4 0 0 0 4.9 4.9L10 20.8a2.1 2.1 0 0 1-3-3z',
  contrast: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 3v18',
  layers: 'm12 3 9 5-9 5-9-5zM3 13l9 5 9-5',
  form: 'M5 4h14v16H5zM8 9h2M12 9h4M8 14h2M12 14h4',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  zoom: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5M8 11h6M11 8v6',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  eyeoff: 'M3 12s3.5-6 9-6c1.5 0 2.8.4 4 1M21 12s-3.5 6-9 6c-1.5 0-2.8-.4-4-1M4 4l16 16',
  pagePlus: 'M6 3h8l4 4v14H6zM14 3v4h4M12 11v6M9 14h6',
}

export function Icon({ name, size = 22, stroke = 1.8 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  )
}

export function Button({ variant = 'primary', busy, icon, children, className = '', ...p }) {
  return (
    <button {...p} className={`btn ${variant} ${className}`} disabled={busy || p.disabled}>
      {busy ? <span className="spin" /> : icon && <Icon name={icon} size={18} />}
      {children}
    </button>
  )
}

export function IconButton({ icon, label, className = '', ...p }) {
  return (
    <button {...p} className={`icon-btn ${className}`} aria-label={label} title={label}>
      <Icon name={icon} size={19} />
    </button>
  )
}

export function Segmented({ value, onChange, options }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div className="seg" style={{ '--n': options.length, '--i': i }} role="group">
      <span className="seg-thumb" />
      {options.map((o) => (
        <button key={String(o.value)} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Switch({ checked, onChange, label }) {
  return <button className="switch" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />
}

export const Group = ({ children }) => <div className="group">{children}</div>

export function ErrorNote({ msg }) {
  return msg ? <div className="error" role="alert">{msg}</div> : null
}

export function ActionBar({ children, info }) {
  return (
    <div className="actionbar">
      <div>
        {info && <span className="info">{info}</span>}
        {children}
      </div>
    </div>
  )
}

function matches(file, accept) {
  if (!accept) return true
  return accept.split(',').some((a) => {
    a = a.trim().toLowerCase()
    if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a)
    if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1))
    return file.type === a
  })
}

export function Dropzone({ accept, multiple, onFiles, title, hint, busy, compact }) {
  const ref = useRef()
  const [over, setOver] = useState(false)
  const [warn, setWarn] = useState('')
  const pick = (list) => {
    const all = [...list]
    const ok = all.filter((f) => matches(f, accept))
    setWarn(ok.length < all.length ? 'Algunos archivos se omitieron porque su formato no es compatible.' : '')
    if (ok.length) onFiles(multiple ? ok : ok.slice(0, 1))
  }
  return (
    <>
      <div
        className={`drop ${over ? 'over' : ''} ${compact ? 'compact' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => ref.current.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files) }}
      >
        <div className="drop-icon">{busy ? <span className="spin" style={{ width: 24, height: 24 }} /> : <Icon name="upload" size={compact ? 20 : 30} />}</div>
        <div>
          <h3>{title || (multiple ? 'Selecciona archivos' : 'Selecciona un archivo')}</h3>
          <p>{hint || 'o arrástralo y suéltalo aquí'}</p>
        </div>
        <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { pick(e.target.files); e.target.value = '' }} />
      </div>
      {warn && <div className="note">{warn}</div>}
    </>
  )
}

export function Result({ result, onReset, resetLabel = 'Empezar de nuevo' }) {
  return (
    <div className="result narrow">
      <div className="check"><Icon name="check" size={36} stroke={2.6} /></div>
      <h2>¡Listo!</h2>
      <p>{result.info || result.name}</p>
      <div className="btns">
        <Button icon="download" onClick={() => saveAs(result.blob, result.name)}>Descargar</Button>
        <Button variant="gray" onClick={onReset}>{resetLabel}</Button>
      </div>
    </div>
  )
}

export function Progress({ value, label }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="progress"><i style={{ width: `${Math.round(value * 100)}%` }} /></div>
      {label && <p className="hint">{label}</p>}
    </div>
  )
}

export function Sheet({ open, onClose, title, children, footer }) {
  const [closing, setClosing] = useState(false)
  const close = () => {
    setClosing(true)
    setTimeout(() => { setClosing(false); onClose() }, 180)
  }
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && close()
    addEventListener('keydown', k)
    return () => removeEventListener('keydown', k)
  })
  if (!open) return null
  return (
    <div className={`sheet-root ${closing ? 'closing' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grabber" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <IconButton icon="close" label="Cerrar" onClick={close} />
        </div>
        {children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  )
}

/** Chips con desplazamiento horizontal (categorías). */
export function Chips({ value, onChange, options }) {
  return (
    <div className="chips" role="group">
      {options.map((o) => (
        <button key={o.value} className="chip" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  )
}

export function Pager({ page, total, onChange }) {
  return (
    <div className="pager">
      <IconButton icon="left" label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)} />
      <span>Página {page} de {total}</span>
      <IconButton icon="right" label="Página siguiente" disabled={page >= total} onClick={() => onChange(page + 1)} />
    </div>
  )
}

/** Campo de contraseña con botón para mostrar/ocultar. */
export function PasswordInput({ value, onChange, placeholder = 'Contraseña', autoFocus }) {
  const [show, setShow] = useState(false)
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} autoComplete="new-password" />
      <IconButton className="plain" icon={show ? 'eyeoff' : 'eye'} label={show ? 'Ocultar' : 'Mostrar'} type="button" onClick={() => setShow(!show)} />
    </span>
  )
}
