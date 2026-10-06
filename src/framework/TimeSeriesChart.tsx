import { useId, useMemo, useState, type PointerEvent } from 'react'
import type { NumericParameters, NumericSnapshot, SimulationDefinition } from './types'
const colors = { position: '#e8b18a', velocity: '#a8bfff', force: '#6ee7c9', neutral: '#d3d3d3' }

/** Each model chooses its plotted keys; the chart has no knowledge of its equations. */
export function TimeSeriesChart({ model, parameters, snapshot, time, duration, onSeek }: {
  model: SimulationDefinition; parameters: NumericParameters; snapshot: NumericSnapshot
  time: number; duration: number; onSeek: (time: number) => void
}) {
  const plots = model.plots ?? []
  const [selectedKey, setSelectedKey] = useState(plots[0]?.key ?? '')
  const selected = plots.find(plot => plot.key === selectedKey) ?? plots[0]
  const [scrubbing, setScrubbing] = useState(false)
  const clipId = useId().replace(/:/g, '')
  const hasPlots = plots.length > 0
  const samples = useMemo(() => hasPlots && duration > 0 && Number.isFinite(duration)
    ? Array.from({ length: 241 }, (_, i) => model.sample(parameters, duration * i / 240))
    : [], [model, parameters, duration, hasPlots])
  if (!selected || !(duration > 0) || !Number.isFinite(duration)) return null
  const left = 60, right = 740, top = 24, bottom = 160
  const values = samples.map(sample => sample[selected.key]).filter(Number.isFinite)
  const max = Math.max(...values.map(value => Math.abs(value)), 0.001) * 1.15
  const y = (value: number) => (top + bottom) / 2 - value / max * (bottom - top) / 2
  const x = (value: number) => left + (right - left) * value / duration
  let connected = false
  const path = samples.map((sample, i) => {
    if (!Number.isFinite(sample[selected.key])) { connected = false; return '' }
    const command = connected ? 'L' : 'M'
    connected = true
    return `${command}${x(duration * i / 240).toFixed(2)},${y(sample[selected.key]).toFixed(2)}`
  }).join(' ')
  const seek = (event: PointerEvent<SVGSVGElement>) => {
    const matrix = event.currentTarget.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    onSeek(Math.max(0, Math.min(duration, (point.x - left) / (right - left) * duration)))
  }
  return <section className="response-chart" aria-label="Motion graph">
    <header><div><span className="eyebrow">RESPONSE</span><span className="chart-title">The same state, plotted in time</span></div><nav aria-label="Graph quantity">{plots.map(plot => <button key={plot.key} aria-pressed={plot.key === selected.key} onClick={() => setSelectedKey(plot.key)}>{plot.label}</button>)}</nav></header>
    <svg viewBox="0 0 760 190" role="img" aria-label={`${selected.label} versus time. Click or drag to seek.`} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); setScrubbing(true); seek(event) }} onPointerMove={event => { if (scrubbing) seek(event) }} onPointerUp={() => setScrubbing(false)} onPointerCancel={() => setScrubbing(false)} onLostPointerCapture={() => setScrubbing(false)}>
      <defs><clipPath id={clipId}><rect x={left} y={top} width={right-left} height={bottom-top} /></clipPath></defs>
      {Array.from({ length: 9 }, (_, i) => <line key={i} x1={left + (right-left)*i/8} x2={left + (right-left)*i/8} y1={top} y2={bottom} stroke="#222" strokeWidth=".6" />)}
      {[-1, -.5, 0, .5, 1].map(value => <g key={value}><line x1={left} x2={right} y1={y(value*max)} y2={y(value*max)} stroke={value === 0 ? '#555' : '#222'} strokeWidth=".6" /><text x={left-10} y={y(value*max)+3} textAnchor="end" className="plot-label">{(value*max).toFixed(max < .1 ? 3 : 2)}</text></g>)}
      {Array.from({ length: 5 }, (_, i) => <text key={i} x={x(duration*i/4)} y={bottom+17} textAnchor="middle" className="plot-label">{(duration*i/4).toFixed(2)}</text>)}
      <text x="5" y="12" className="plot-label">{selected.label}{selected.unit ? ` (${selected.unit})` : ''}</text><text x={right} y="189" textAnchor="end" className="plot-label">t (s)</text>
      <path d={path} stroke={colors[selected.tone ?? 'neutral']} fill="none" strokeWidth="1.8" clipPath={`url(#${clipId})`} />
      <line x1={x(time)} x2={x(time)} y1={top} y2={bottom} stroke="#ddd" opacity=".45" />
      {Number.isFinite(snapshot[selected.key]) && <circle cx={x(time)} cy={y(snapshot[selected.key])} r="4.5" fill={colors[selected.tone ?? 'neutral']} />}
    </svg>
    <p>Click or drag to seek. The scene, readouts, equation, and cursor show the same instant.</p>
  </section>
}
