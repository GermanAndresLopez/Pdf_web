// Genera las ilustraciones SVG del README (docs/img) a partir del registro de herramientas.
// Uso: node scripts/gen-docs.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const ui = readFileSync('src/components/ui.jsx', 'utf8')
const block = ui.slice(ui.indexOf('const PATHS = {'), ui.indexOf('\n}\n', ui.indexOf('const PATHS = {')))
const PATHS = Object.fromEntries([...block.matchAll(/^\s{2}(\w+): '([^']+)',?$/gm)].map((m) => [m[1], m[2]]))

const src = readFileSync('src/tools/index.js', 'utf8')
const TOOLS = [...src.matchAll(/t\('([^']+)', '([^']+)', '([^']+)', \['([^']+)', '([^']+)'\], '([^']+)', '([^']+)'/g)].map((m) => ({
  id: m[1], cat: m[2], icon: m[3], c1: m[4], c2: m[5], title: m[6], desc: m[7],
}))
const CATS = {
  organize: 'Organizar', edit: 'Editar y revisar', convert: 'Convertir', optimize: 'Optimizar', secure: 'Seguridad',
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Inter,Helvetica,Arial,sans-serif"
const wrap = (s, n) => {
  const out = []
  let line = ''
  for (const w of s.split(' ')) {
    if ((line + ' ' + w).trim().length > n) { out.push(line); line = w } else line = (line + ' ' + w).trim()
  }
  if (line) out.push(line)
  return out
}
const defs = (tools) =>
  `<defs>${tools.map((t) => `<linearGradient id="g-${t.id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset="1" stop-color="${t.c2}"/></linearGradient>`).join('')}
  <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#000" flood-opacity=".09"/></filter></defs>`
const icon = (name, x, y, size, color = '#fff') =>
  `<g transform="translate(${x} ${y}) scale(${size / 24})" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="${PATHS[name]}"/></g>`
const tile = (t, x, y, s = 56) =>
  `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.25}" fill="url(#g-${t.id})"/>${icon(t.icon, x + s * 0.25, y + s * 0.25, s * 0.5)}`

mkdirSync('docs/img', { recursive: true })
const write = (name, svg) => writeFileSync(`docs/img/${name}.svg`, svg)

// ── Paneles por categoría ──
for (const [cat, label] of Object.entries(CATS)) {
  const list = TOOLS.filter((t) => t.cat === cat)
  const cols = 2, W = 1000, cw = 460, ch = 118, gx = 40, top = 120
  const rows = Math.ceil(list.length / cols)
  const H = top + rows * (ch + 20) + 30
  const cards = list.map((t, i) => {
    const x = gx + (i % cols) * (cw + 20), y = top + Math.floor(i / cols) * (ch + 20)
    const lines = wrap(t.desc, 46).slice(0, 3)
    return `<g filter="url(#sh)"><rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="22" fill="#fff"/></g>${tile(t, x + 20, y + 20)}
    <text x="${x + 94}" y="${y + 38}" font-size="19" font-weight="700" fill="#111">${esc(t.title)}</text>
    ${lines.map((l, k) => `<text x="${x + 94}" y="${y + 62 + k * 20}" font-size="14" fill="#6b6b73">${esc(l)}</text>`).join('')}`
  })
  write(`cat-${cat}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
  ${defs(list)}<rect width="${W}" height="${H}" rx="28" fill="#f2f2f7"/>
  <text x="${gx}" y="62" font-size="34" font-weight="800" fill="#111">${label}</text>
  <text x="${gx}" y="92" font-size="16" fill="#6b6b73">${list.length} herramientas</text>${cards.join('')}</svg>`)
}

// ── Banner ──
const pick = ['merge', 'edit', 'compress', 'ocr', 'protect', 'word-to-pdf', 'redact'].map((id) => TOOLS.find((t) => t.id === id)).filter(Boolean)
write('banner', `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="420" viewBox="0 0 1200 420" font-family="${FONT}">
  ${defs(pick)}<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ac8fa"/><stop offset="1" stop-color="#0a64e8"/></linearGradient></defs>
  <rect width="1200" height="420" rx="32" fill="url(#bg)"/>
  <circle cx="1060" cy="40" r="190" fill="#fff" opacity=".08"/><circle cx="1130" cy="400" r="150" fill="#fff" opacity=".07"/>
  <g transform="translate(70 70)"><rect width="64" height="64" rx="16" fill="#fff" opacity=".95"/>
    <path transform="translate(14 14) scale(1.5)" fill="none" stroke="#0a64e8" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="${PATHS.file}"/></g>
  <text x="70" y="190" font-size="64" font-weight="800" fill="#fff">pdf_Web</text>
  <text x="70" y="238" font-size="26" fill="#fff" opacity=".92">Todo lo que necesitas para tus PDF y Word.</text>
  <text x="70" y="280" font-size="20" fill="#fff" opacity=".8">Edita, une, divide, convierte y protege — directamente en tu navegador.</text>
  <g transform="translate(70 318)"><rect width="330" height="46" rx="23" fill="#fff" opacity=".18"/>
    <text x="165" y="30" font-size="17" font-weight="600" fill="#fff" text-anchor="middle">${TOOLS.length} herramientas · 100 % privado</text></g>
  ${pick.map((t, i) => { const x = 640 + (i % 4) * 130, y = 70 + Math.floor(i / 4) * 150 + (i % 2) * 28; return `<g filter="url(#sh)">${tile(t, x, y, 92)}</g><text x="${x + 46}" y="${y + 118}" font-size="14" font-weight="600" fill="#fff" text-anchor="middle">${esc(t.title.split(' ').slice(0, 2).join(' '))}</text>` }).join('')}
</svg>`)

// ── Maqueta del editor ──
write('editor', `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640" viewBox="0 0 1000 640" font-family="${FONT}">
  <defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000" flood-opacity=".15"/></filter></defs>
  <rect width="1000" height="640" rx="28" fill="#f2f2f7"/>
  <rect width="1000" height="56" rx="28" fill="#fff" opacity=".9"/><rect y="28" width="1000" height="28" fill="#fff" opacity=".9"/>
  <text x="34" y="36" font-size="17" font-weight="600" fill="#007aff">‹ Inicio</text><text x="500" y="36" font-size="17" font-weight="600" fill="#111" text-anchor="middle">Editar PDF</text>
  <g filter="url(#sh)"><rect x="250" y="80" width="500" height="470" rx="6" fill="#fff"/></g>
  <rect x="290" y="116" width="220" height="16" rx="4" fill="#222"/>
  ${[0, 1, 2, 3].map((i) => `<rect x="290" y="${160 + i * 24}" width="${420 - (i % 2) * 60}" height="9" rx="4" fill="#d1d1d6"/>`).join('')}
  <rect x="284" y="262" width="330" height="26" rx="4" fill="#007aff" opacity=".13" stroke="#007aff" stroke-dasharray="5 4"/>
  <text x="290" y="281" font-size="15" fill="#111">Texto que ahora puedes cambiar</text>
  <rect x="290" y="312" width="150" height="9" rx="4" fill="#d1d1d6"/><rect x="448" y="304" width="150" height="22" rx="3" fill="#ffcc00" opacity=".45"/>
  <ellipse cx="620" cy="400" rx="70" ry="34" fill="none" stroke="#ff3b30" stroke-width="3"/>
  <path d="M300 430 C340 400, 360 470, 400 430 S460 410, 480 440" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/>
  <path d="M520 500 L600 470 M600 470 l-14 -2 M600 470 l-4 13" fill="none" stroke="#34c759" stroke-width="3" stroke-linecap="round"/>
  <g filter="url(#sh)"><rect x="120" y="574" width="760" height="58" rx="29" fill="#fff" opacity=".95"/></g>
  ${[['edit', 'Editar texto', 1], ['cursor', 'Mover'], ['text', 'Añadir'], ['pen', 'Dibujar'], ['highlight', 'Resaltar'], ['rect', 'Formas'], ['eraser', 'Borrar'], ['image', 'Imagen'], ['signature', 'Firma']].map((it, i) => {
    const x = 138 + i * 82
    return `${it[2] ? `<rect x="${x - 8}" y="580" width="76" height="46" rx="16" fill="#007aff"/>` : ''}${icon(it[0], x + 14, 586, 24, it[2] ? '#fff' : '#6b6b73')}<text x="${x + 26}" y="621" font-size="10" font-weight="500" fill="${it[2] ? '#fff' : '#6b6b73'}" text-anchor="middle">${it[1]}</text>`
  }).join('')}
  <g transform="translate(790 96)"><rect width="160" height="44" rx="14" fill="#007aff"/><text x="80" y="28" font-size="15" font-weight="600" fill="#fff" text-anchor="middle">Guardar PDF</text></g>
</svg>`)

// ── Privacidad ──
const flow = [['file', 'Tu archivo', '#ff9500'], ['shield', 'Se procesa en tu navegador', '#007aff'], ['download', 'Descargas el resultado', '#34c759']]
write('privacy', `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="260" viewBox="0 0 1000 260" font-family="${FONT}">
  <defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#000" flood-opacity=".09"/></filter></defs>
  <rect width="1000" height="260" rx="28" fill="#f2f2f7"/>
  ${flow.map((f, i) => { const x = 60 + i * 320; return `<g filter="url(#sh)"><rect x="${x}" y="50" width="260" height="130" rx="24" fill="#fff"/></g><rect x="${x + 100}" y="68" width="60" height="60" rx="16" fill="${f[2]}"/>${icon(f[0], x + 115, 83, 30)}<text x="${x + 130}" y="158" font-size="17" font-weight="600" fill="#111" text-anchor="middle">${f[1]}</text>${i < 2 ? `<path d="M${x + 272} 115 h36 m-10 -9 l10 9 l-10 9" fill="none" stroke="#8e8e93" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}` }).join('')}
  <text x="500" y="226" font-size="16" fill="#6b6b73" text-anchor="middle">Nada se sube a ningún servidor: tus documentos nunca salen de tu equipo.</text>
</svg>`)

console.log(`Generadas ${Object.keys(CATS).length + 3} ilustraciones con ${TOOLS.length} herramientas en docs/img`)
