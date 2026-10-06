import { useEffect, useId, useRef, useState } from 'react'
import type { ParameterDefinition } from './types'

export type ParameterControlProps = {
  definition: ParameterDefinition
  value: number
  onChange: (value: number) => void
}

/** A synchronized slider and editable number with bounded, finite commits. */
export function ParameterControl({ definition: d, value, onChange }: ParameterControlProps) {
  const id = useId()
  const inputId = `parameter-${id}`
  const noteId = `${inputId}-note`
  const min = Math.min(d.min, d.max)
  const max = Math.max(d.min, d.max)
  const current = Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min
  const [draft, setDraft] = useState(String(current))
  const skipBlur = useRef(false)
  useEffect(() => setDraft(String(current)), [current])

  const commit = () => {
    if (skipBlur.current) { skipBlur.current = false; return }
    const parsed = Number(draft)
    if (!draft.trim() || !Number.isFinite(parsed)) {
      setDraft(String(current))
      return
    }
    const next = Math.max(min, Math.min(max, parsed))
    setDraft(String(next))
    if (next !== current) onChange(next)
  }

  return <div className="parameter-control" data-control data-control-label={d.label}>
    <div className="parameter-top">
      <label htmlFor={inputId}>{d.label}</label>
      {d.symbol && <span aria-hidden="true">{d.symbol}</span>}
    </div>
    <div className="parameter-inputs">
      <input type="range" aria-label={`${d.label} slider`} aria-describedby={d.note ? noteId : undefined}
        min={min} max={max} step={d.step} value={current}
        onChange={event => {
          const next = Number(event.target.value)
          if (Number.isFinite(next)) {
            setDraft(String(next))
            if (next !== current) onChange(next)
          }
        }} />
      <input id={inputId} type="number" data-unit={d.unit ?? ''} aria-label={d.label}
        aria-describedby={d.note ? noteId : undefined} min={min} max={max} step={d.step} value={draft}
        onChange={event => setDraft(event.target.value)} onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault()
            // Blur owns the commit so Enter never triggers the callback twice.
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            skipBlur.current = true
            setDraft(String(current))
            event.currentTarget.blur()
          }
        }} />
      {d.unit && <span className="control-unit">{d.unit}</span>}
    </div>
    {d.note && <small id={noteId} className="control-note">{d.note}</small>}
  </div>
}

export default ParameterControl
