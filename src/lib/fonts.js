import { StandardFonts } from 'pdf-lib'

// Fuentes estándar del PDF (siempre disponibles, no hace falta incrustarlas desde un archivo)
export const STD = {
  sans: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'],
  serif: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'],
  mono: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'],
}
export const CSS_FAM = { sans: 'Helvetica, Arial, sans-serif', serif: '"Times New Roman", Times, serif', mono: '"Courier New", monospace' }
export const FAMILIES = [{ value: 'sans', label: 'Sans' }, { value: 'serif', label: 'Serif' }, { value: 'mono', label: 'Mono' }]
export const stdFont = (a) => StandardFonts[STD[a.family || 'sans'][(a.bold ? 1 : 0) + (a.italic ? 2 : 0)]]
