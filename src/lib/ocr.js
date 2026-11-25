import { createWorker } from 'tesseract.js'

export const OCR_LANGS = [
  ['spa', 'Español'],
  ['eng', 'Inglés'],
  ['spa+eng', 'Español + Inglés'],
  ['fra', 'Francés'],
  ['por', 'Portugués'],
  ['deu', 'Alemán'],
  ['ita', 'Italiano'],
]

/** Crea un worker de Tesseract (descarga el idioma la primera vez, hace falta conexión). */
export const createOcr = (lang, onStatus) => createWorker(lang, 1, { logger: (m) => onStatus?.(m) })
