import { useState } from 'react'

/** Ejecuta una tarea async y gestiona busy / error / resultado. */
export function useTask() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const run = async (fn) => {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const r = await fn()
      if (r) setResult(r)
    } catch (e) {
      console.error(e)
      setError(e?.message || 'Ocurrió un error inesperado.')
    } finally {
      setBusy(false)
    }
  }
  const reset = () => {
    setResult(null)
    setError('')
  }
  return { busy, error, result, run, reset, setError }
}

/** Reordenar listas con arrastrar y soltar nativo. */
export function useReorder(setItems) {
  const [from, setFrom] = useState(null)
  return (i) => ({
    draggable: true,
    onDragStart: () => setFrom(i),
    onDragOver: (e) => e.preventDefault(),
    onDrop: () => {
      if (from === null || from === i) return
      setItems((a) => {
        const b = [...a]
        const [m] = b.splice(from, 1)
        b.splice(i, 0, m)
        return b
      })
      setFrom(null)
    },
    onDragEnd: () => setFrom(null),
  })
}

export const moveItem = (setItems, i, dir) =>
  setItems((a) => {
    const j = i + dir
    if (j < 0 || j >= a.length) return a
    const b = [...a]
    ;[b[i], b[j]] = [b[j], b[i]]
    return b
  })
