import { Suspense, useEffect, useMemo, useState } from 'react'
import { CATEGORIES, TOOLS } from './tools'
import { Chips, Icon, IconButton } from './components/ui'

const getRoute = () => location.hash.replace(/^#\/?/, '')

function useStored(key, init) {
  const [v, setV] = useState(() => { try { return JSON.parse(localStorage.getItem(key)) ?? init } catch { return init } })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* sin espacio */ } }, [key, v])
  return [v, setV]
}

function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'))
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#000000' : '#f2f2f7')
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

const cardStyle = (t, i = 0) => ({ '--i': i, '--c1': t.colors[0], '--c2': t.colors[1] })

function Home({ favs, setFavs, recent }) {
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const byId = (id) => TOOLS.find((t) => t.id === id)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return TOOLS.filter((t) => (cat === 'all' || t.cat === cat) && (!s || (t.title + ' ' + t.desc).toLowerCase().includes(s)))
  }, [cat, q])
  const toggleFav = (id) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
  const showRows = cat === 'all' && !q.trim()
  const favTools = favs.map(byId).filter(Boolean)
  const recentTools = recent.map(byId).filter(Boolean)

  const MiniRow = ({ title, items }) => items.length > 0 && (
    <div className="home-row">
      <h4>{title}</h4>
      <div className="mini-tools">
        {items.map((t) => (
          <a key={t.id} href={`#/${t.id}`} className="mini-tool" style={cardStyle(t)}>
            <span className="app-icon"><Icon name={t.icon} size={18} /></span>{t.title}
          </a>
        ))}
      </div>
    </div>
  )

  return (
    <div className="page-enter">
      <section className="hero">
        <h1>Todo lo que necesitas<br />para tus PDF y Word</h1>
        <p>{TOOLS.length} herramientas para editar, unir, dividir, convertir y proteger documentos, directamente en tu navegador.</p>
      </section>
      <div className="controls">
        <label className="search">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Buscar herramienta" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar herramienta" />
        </label>
        <Chips value={cat} onChange={setCat} options={CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
      </div>
      {showRows && MiniRow({ title: "Favoritas", items: favTools })}
      {showRows && MiniRow({ title: "Usadas recientemente", items: recentTools.filter((t) => !favs.includes(t.id)).slice(0, 6) })}
      {list.length ? (
        <div className="grid" key={cat + q}>
          {list.map((t, i) => (
            <div key={t.id} className="card-wrap">
              <a href={`#/${t.id}`} className="tool-card" style={cardStyle(t, i)}>
                <div className="app-icon"><Icon name={t.icon} size={26} /></div>
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.desc}</p>
                </div>
              </a>
              <button className={`fav ${favs.includes(t.id) ? 'on' : ''}`} aria-label={favs.includes(t.id) ? 'Quitar de favoritas' : 'Añadir a favoritas'} aria-pressed={favs.includes(t.id)} onClick={() => toggleFav(t.id)}>
                <Icon name="star" size={18} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">No encontramos ninguna herramienta con «{q}».</p>
      )}
      <p className="privacy"><Icon name="shield" size={18} /> Tus archivos se procesan en tu dispositivo y nunca se suben a ningún servidor.</p>
    </div>
  )
}

export default function App() {
  const [route, setRoute] = useState(getRoute)
  const [theme, toggleTheme] = useTheme()
  const [favs, setFavs] = useStored('pdfweb:favs', [])
  const [recent, setRecent] = useStored('pdfweb:recent', [])
  const tool = TOOLS.find((t) => t.id === route)

  useEffect(() => {
    const h = () => { setRoute(getRoute()); scrollTo(0, 0) }
    addEventListener('hashchange', h)
    return () => removeEventListener('hashchange', h)
  }, [])

  useEffect(() => {
    document.title = tool ? `${tool.title} — pdf_Web` : 'pdf_Web — Herramientas de PDF y Word'
    if (tool) setRecent((r) => [tool.id, ...r.filter((x) => x !== tool.id)].slice(0, 8))
  }, [tool, setRecent])

  return (
    <>
      <header className="app-header">
        <div className="app-header-inner">
          {tool ? (
            <>
              <a className="back" href="#/"><Icon name="left" size={22} stroke={2.2} />Inicio</a>
              <h2 className="header-title">{tool.title}</h2>
            </>
          ) : (
            <>
              <a className="brand" href="#/">
                <span className="brand-logo"><Icon name="file" size={18} stroke={2.2} /></span>
                pdf_Web
              </a>
              <span className="spacer" />
            </>
          )}
          <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label="Cambiar tema" onClick={toggleTheme} />
        </div>
      </header>
      <main className="main">
        {tool ? (
          <div key={tool.id} className="page-enter">
            <Suspense fallback={<p className="hint">Cargando…</p>}>
              <tool.Comp />
            </Suspense>
          </div>
        ) : (
          <Home favs={favs} setFavs={setFavs} recent={recent} />
        )}
      </main>
    </>
  )
}
