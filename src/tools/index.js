import { lazy } from 'react'

export const CATEGORIES = [
  { id: 'all', label: 'Todas' },
  { id: 'organize', label: 'Organizar' },
  { id: 'edit', label: 'Editar' },
  { id: 'convert', label: 'Convertir' },
  { id: 'optimize', label: 'Optimizar' },
  { id: 'secure', label: 'Seguridad' },
]

const t = (id, cat, icon, colors, title, desc, load) => ({ id, cat, icon, colors, title, desc, Comp: lazy(load) })

export const TOOLS = [
  // Organizar
  t('merge', 'organize', 'merge', ['#ff6b5e', '#ff3b30'], 'Unir PDF', 'Combina varios PDF en uno, elige las páginas de cada archivo y añade marcadores.', () => import('./Merge.jsx')),
  t('split', 'organize', 'split', ['#ffb340', '#ff9500'], 'Dividir PDF', 'Separa por rangos, cada N páginas, por tamaño, por hojas en blanco o extrae páginas.', () => import('./Split.jsx')),
  t('organize', 'organize', 'organize', ['#bf5af2', '#8944ab'], 'Organizar páginas', 'Reordena, gira, duplica, elimina e inserta páginas en blanco u otros PDF.', () => import('./Organize.jsx')),
  t('delete', 'organize', 'trash', ['#ff8a80', '#e53935'], 'Eliminar o extraer páginas', 'Elige páginas con miniaturas y quítalas o conserva solo esas.', () => import('./DeletePages.jsx')),
  t('rotate', 'organize', 'rotate', ['#64d2ff', '#32ade6'], 'Girar y enderezar', 'Gira 90°/180° o endereza escaneos torcidos con un ángulo libre.', () => import('./Rotate.jsx')),
  t('crop', 'organize', 'crop', ['#7be0a6', '#2db36b'], 'Recortar PDF', 'Recorta márgenes a mano o quita los blancos automáticamente.', () => import('./Crop.jsx')),
  // Editar
  t('edit', 'edit', 'edit', ['#5ac8fa', '#007aff'], 'Editar PDF', 'Cambia el texto existente, añade texto, formas, dibujos, imágenes y firma.', () => import('./Edit.jsx')),
  t('forms', 'edit', 'form', ['#8e9bff', '#5856d6'], 'Rellenar formularios', 'Completa campos, casillas y desplegables de un PDF con formulario.', () => import('./FillForm.jsx')),
  t('watermark', 'edit', 'droplet', ['#66d4cf', '#30b0c7'], 'Marca de agua', 'Estampa texto o un logo, en mosaico o en una esquina, con vista previa.', () => import('./Watermark.jsx')),
  t('numbers', 'edit', 'hash', ['#ff7aa8', '#ff2d55'], 'Números de página', 'Numeración con formatos, romanos, plantillas y posición espejo, con vista previa.', () => import('./PageNumbers.jsx')),
  t('bookmarks', 'edit', 'bookmark', ['#ffd60a', '#ff9f0a'], 'Marcadores e índice', 'Crea el índice lateral del PDF; detecta los títulos automáticamente.', () => import('./Bookmarks.jsx')),
  t('metadata', 'edit', 'info', ['#a2a2a8', '#636366'], 'Metadatos', 'Edita título, autor y palabras clave o elimínalos todos.', () => import('./Metadata.jsx')),
  t('attach', 'edit', 'paperclip', ['#9ad0ff', '#3a8dde'], 'Adjuntar archivos', 'Incrusta archivos dentro del PDF.', () => import('./Attach.jsx')),
  t('compare', 'edit', 'compare', ['#ff9f7a', '#ff6a3d'], 'Comparar PDF', 'Detecta diferencias visuales y de texto entre dos versiones.', () => import('./Compare.jsx')),
  // Convertir
  t('word-to-pdf', 'convert', 'word', ['#4f9bff', '#1c5fd6'], 'Word a PDF', 'Convierte uno o varios .docx con tamaño, márgenes y fuente a elección.', () => import('./WordToPdf.jsx')),
  t('pdf-to-word', 'convert', 'file', ['#5e8bff', '#2a4bd7'], 'PDF a Word', 'Reconstruye párrafos, títulos, listas y tablas; con OCR para escaneados.', () => import('./PdfToWord.jsx')),
  t('excel-to-pdf', 'convert', 'table', ['#5fd68a', '#1e9e55'], 'Excel a PDF', 'Convierte hojas de cálculo y CSV, hoja por hoja, ajustadas al ancho.', () => import('./ExcelToPdf.jsx')),
  t('pdf-to-excel', 'convert', 'table', ['#34c759', '#188038'], 'PDF a Excel', 'Detecta tablas y las exporta a .xlsx o CSV.', () => import('./PdfToExcel.jsx')),
  t('pdf-to-pptx', 'convert', 'slides', ['#ff9560', '#e0501f'], 'PDF a PowerPoint', 'Crea una presentación con imágenes fieles o texto editable.', () => import('./PdfToPptx.jsx')),
  t('img-to-pdf', 'convert', 'image', ['#ffd60a', '#ff9f0a'], 'Imágenes a PDF', 'Une fotos en un PDF; gira, ajusta, comprime o usa la cámara del móvil.', () => import('./ImgToPdf.jsx')),
  t('pdf-to-img', 'convert', 'image', ['#ff9f7a', '#ff6a3d'], 'PDF a imágenes', 'Exporta PNG, JPG o WEBP hasta 300 dpi, o una sola imagen larga.', () => import('./PdfToImg.jsx')),
  t('text-to-pdf', 'convert', 'text', ['#8e8e93', '#636366'], 'Texto a PDF', 'Editor con formato, texto plano o HTML; importa .txt, .html y .docx.', () => import('./TextToPdf.jsx')),
  t('ocr', 'convert', 'scan', ['#b388ff', '#7c4dff'], 'OCR (reconocer texto)', 'Hace buscable un PDF escaneado, o lo convierte a Word o texto.', () => import('./Ocr.jsx')),
  // Optimizar
  t('compress', 'optimize', 'compress', ['#6fdc8c', '#34c759'], 'Comprimir PDF', 'Sin pérdida, por nivel, personalizado o hasta un tamaño objetivo.', () => import('./Compress.jsx')),
  t('grayscale', 'optimize', 'contrast', ['#9e9e9e', '#4a4a4a'], 'Escala de grises / B/N', 'Ahorra tinta y peso; conserva el texto buscable.', () => import('./Grayscale.jsx')),
  t('flatten', 'optimize', 'layers', ['#80cbc4', '#26897e'], 'Aplanar PDF', 'Fija formularios y anotaciones para que nadie pueda cambiarlos.', () => import('./Flatten.jsx')),
  t('repair', 'optimize', 'wrench', ['#ffcc80', '#fb8c00'], 'Reparar PDF', 'Recupera páginas de un archivo dañado que no se abre.', () => import('./Repair.jsx')),
  // Seguridad
  t('protect', 'secure', 'lock', ['#ff8a8a', '#d93a3a'], 'Proteger PDF', 'Cifra con contraseña y limita imprimir, copiar o modificar.', () => import('./Protect.jsx')),
  t('unlock', 'secure', 'unlock', ['#a5d6a7', '#43a047'], 'Desbloquear PDF', 'Quita la contraseña de un PDF si la conoces.', () => import('./Unlock.jsx')),
  t('redact', 'secure', 'redact', ['#616161', '#212121'], 'Censurar información', 'Tapa datos sensibles de verdad: busca por texto, correos, teléfonos o fechas.', () => import('./Redact.jsx')),
]
