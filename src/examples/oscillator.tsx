import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { defineSimulation } from '../framework/model'
import { MathFormula } from '../framework/Math'
import type { FormulaEntry, NumericParameters, SimulationLessonProps, SimulationSceneProps } from '../framework/types'
import './examples.css'

const TAU = 2 * Math.PI
const defaults = { mass: 2, spring: 18, release: 0.2, initialVelocity: 0 }

function n(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (Math.abs(value) < 1e-10) return '0'
  return Number(value.toPrecision(4)).toString()
}

function tex(value: number): string {
  const [coefficient, exponent] = n(value).split('e')
  return exponent ? `${coefficient}\\times10^{${Number(exponent)}}` : coefficient
}

function rhythm(p: NumericParameters) {
  const omega = Math.sqrt(p.spring / p.mass)
  return { omega, frequency: omega / TAU, period: TAU / omega }
}

export function sampleOscillator(p: NumericParameters, time: number) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0
  const { omega, frequency, period } = rhythm(p)
  // Reduce phase before evaluating trig so long seeks retain a bounded argument.
  const phase = omega * (t % period)
  const x = p.release * Math.cos(phase) + p.initialVelocity / omega * Math.sin(phase)
  const velocity = -p.release * omega * Math.sin(phase) + p.initialVelocity * Math.cos(phase)
  const acceleration = -(omega ** 2) * x
  const kinetic = 0.5 * p.mass * velocity ** 2
  const potential = 0.5 * p.spring * x ** 2
  return {
    time: t, x, velocity, acceleration, omega, frequency, period,
    force: -p.spring * x,
    amplitude: Math.hypot(p.release, p.initialVelocity / omega),
    kinetic, potential, totalEnergy: kinetic + potential,
  }
}

function springPoints(start: number, end: number, y: number): string {
  const lead = Math.min(12, (end - start) / 6)
  const points = [`${start},${y}`, `${start + lead},${y}`]
  for (let index = 0; index <= 14; index++) {
    const x = start + lead + (end - start - lead * 2) * index / 14
    points.push(`${x},${index === 0 || index === 14 ? y : y + (index % 2 ? -11 : 11)}`)
  }
  points.push(`${end},${y}`)
  return points.join(' ')
}

function OscillatorScene({ parameters: p, snapshot: s, display, onParameterChange, onInteractionStart, onInteractionEnd }: SimulationSceneProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const interaction = useRef(false)
  const capturedScale = useRef<number | null>(null)
  const [interactionScale, setInteractionScale] = useState<number | null>(null)
  const sceneId = useId()
  const scale = interactionScale ?? 240 / Math.max(0.4, s.amplitude)
  const center = 380 + scale * s.x
  const forceLength = s.amplitude > 0 ? Math.min(100, Math.abs(s.x) / s.amplitude * 100) : 0
  const forceEnd = center - Math.sign(s.x) * forceLength
  const start = () => {
    if (!interaction.current) {
      interaction.current = true
      capturedScale.current = scale
      setInteractionScale(scale)
      onInteractionStart()
    }
  }
  const finish = () => {
    if (interaction.current) {
      interaction.current = false
      capturedScale.current = null
      setInteractionScale(null)
      onInteractionEnd()
    }
  }
  const setRelease = (value: number) => onParameterChange('release', Math.max(-0.4, Math.min(0.4, value)))
  const drag = (event: PointerEvent<SVGGElement>) => {
    const matrix = svgRef.current?.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    setRelease((point.x - 380) / (capturedScale.current ?? scale))
  }
  const keyboard = (event: KeyboardEvent<SVGGElement>) => {
    const next = event.key === 'ArrowRight' || event.key === 'ArrowUp' ? p.release + 0.01
      : event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? p.release - 0.01
        : event.key === 'Home' ? -0.4 : event.key === 'End' ? 0.4 : undefined
    if (next === undefined) return
    event.preventDefault()
    start()
    setRelease(next)
  }
  return <svg ref={svgRef} className="example-scene oscillator-scene" viewBox="0 0 760 400" aria-labelledby={`${sceneId}-title`}>
    <title id={`${sceneId}-title`}>A block on a horizontal track attached to one spring</title>
    <line className="example-track" x1="58" y1="262" x2="706" y2="262" />
    <path className="example-support" d="M58 158V262M44 158L58 172M44 180L58 194M44 202L58 216M44 224L58 238M44 246L58 260" />
    <line className="example-equilibrium" x1="380" y1="110" x2="380" y2="308" />
    <polyline className="example-spring" points={springPoints(58, center - 44, 218)} />
    {display.labels && <>
      <text className="example-scene-label" x="380" y="95" textAnchor="middle">EQUILIBRIUM</text>
      <text className="example-scene-label" x={(58 + center - 44) / 2} y="190" textAnchor="middle">k = {n(p.spring)} N/m</text>
      <text className="example-scene-value" x="380" y="340" textAnchor="middle">x = {n(s.x)} m</text>
      <text className="example-scene-label" x="380" y="363" textAnchor="middle">POSITIVE TO THE RIGHT</text>
    </>}
    <g className="example-drag-handle" role="slider" tabIndex={0} aria-label="Initial position"
      aria-valuemin={-0.4} aria-valuemax={0.4} aria-valuenow={p.release} aria-valuetext={`${n(p.release)} metres`}
      onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); start(); drag(event) }}
      onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) drag(event) }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); finish() }}
      onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={keyboard} onKeyUp={finish} onBlur={finish}>
      <rect className="example-block-focus" x={center - 51} y="167" width="102" height="100" rx="7" />
      <rect className="example-block" x={center - 44} y="174" width="88" height="84" rx="4" />
      <text className="example-block-text" x={center} y="214" textAnchor="middle">{n(p.mass)}</text>
      <text className="example-scene-label" x={center} y="234" textAnchor="middle">kg</text>
    </g>
    {display.forces && forceLength > 0.5 && <g className="example-force">
      <line x1={center} y1="142" x2={forceEnd} y2="142" />
      <path d={`M${forceEnd + Math.sign(s.x) * 7} 137L${forceEnd} 142L${forceEnd + Math.sign(s.x) * 7} 147`} />
      {display.labels && <text x={(center + forceEnd) / 2} y="128" textAnchor="middle">F = −kx</text>}
    </g>}
  </svg>
}

function OscillatorLesson({ parameters: p, snapshot: s, time }: SimulationLessonProps) {
  return <section className="example-lesson" aria-label="Oscillator equations">
    <header><span className="example-eyebrow">THE EQUATION / t = {n(time)} s</span><h2>A restoring force.</h2></header>
    <div className="example-equation-card">
      <MathFormula tex={String.raw`m\ddot x+kx=0`} />
      <div className="example-factor-grid">
        <div><span>Mass · m</span><output>{n(p.mass)} <small>kg</small></output></div>
        <div><span>Spring stiffness · k</span><output>{n(p.spring)} <small>N/m</small></output></div>
        <div><span>Displacement · x</span><output>{n(s.x)} <small>m</small></output></div>
        <div><span>Acceleration · ẍ</span><output>{n(s.acceleration)} <small>m/s²</small></output></div>
      </div>
      <MathFormula tex={String.raw`\underbrace{${tex(p.mass)}}_{m}\underbrace{(${tex(s.acceleration)})}_{\ddot x}+\underbrace{${tex(p.spring)}}_k\underbrace{(${tex(s.x)})}_x\approx0\;\mathrm N`} />
      <p>The spring force points toward equilibrium. The signed inertia and stiffness terms cancel; displayed values are rounded.</p>
    </div>
    <div className="example-equation-card">
      <MathFormula tex={String.raw`\omega=\sqrt{k/m},\qquad f=\frac{\omega}{2\pi},\qquad T=\frac{2\pi}{\omega}`} />
      <dl className="example-metrics"><div><dt>Angular frequency</dt><dd>{n(s.omega)} rad/s</dd></div><div><dt>Frequency</dt><dd>{n(s.frequency)} Hz</dd></div><div><dt>Period</dt><dd>{n(s.period)} s</dd></div></dl>
    </div>
    <details className="example-detail"><summary>Derive the motion</summary><div>
      <MathFormula tex={String.raw`\sum F=-kx=m\ddot x\quad\Longrightarrow\quad\ddot x+\omega^2x=0`} />
      <MathFormula tex={String.raw`x(t)=x_0\cos(\omega t)+\frac{v_0}{\omega}\sin(\omega t)`} />
      <p>Initial position chooses the cosine term; initial velocity chooses the sine term. Differentiating twice returns −ω²x, so this response satisfies the equation.</p>
    </div></details>
    <details className="example-detail"><summary>Follow the energy</summary><div>
      <MathFormula tex={String.raw`E=\underbrace{\tfrac12m\dot x^2}_{K}+\underbrace{\tfrac12kx^2}_{U}=\text{constant}`} />
      <dl className="example-metrics"><div><dt>Kinetic energy</dt><dd>{n(s.kinetic)} J</dd></div><div><dt>Spring potential</dt><dd>{n(s.potential)} J</dd></div><div><dt>Total energy</dt><dd>{n(s.totalEnergy)} J</dd></div></dl>
      <p>Energy moves between the mass and spring. There is no friction or damping in this example.</p>
    </div></details>
  </section>
}

function OscillatorDetails() {
  return <div className="example-supporting-notes"><h3>Try a comparison.</h3><p>Double the mass and compare the period. Then double the stiffness. A larger release changes the energy and amplitude, while frequency stays set by mass and stiffness.</p><p>The track is frictionless, the spring is linear, and the coordinate is measured from equilibrium. The drawing rescales to keep the full response visible.</p></div>
}

const sources = ['Original harmonic-oscillator starter example; derived from Newton’s law and Hooke’s law.']
const formulas: FormulaEntry[] = [
  { id: 'oscillator-force', group: 'Force and motion', title: 'Newton’s law and restoring force', description: 'The spring force opposes displacement from equilibrium.', tex: [String.raw`F=-kx=m\ddot x`, String.raw`m\ddot x+kx=0`], usage: 'This force balance generates the sampled motion.', sources },
  { id: 'oscillator-frequency', group: 'Force and motion', title: 'Frequency and period', description: 'Angular frequency counts radians per second; frequency counts cycles per second.', tex: [String.raw`\omega=\sqrt{k/m}`, String.raw`f=\omega/(2\pi),\qquad T=2\pi/\omega`], usage: 'Positive mass and stiffness give a real, finite period.', sources },
  { id: 'oscillator-response', group: 'Initial conditions and derivatives', title: 'Analytical state at any time', description: 'Two initial conditions determine the harmonic response.', tex: [String.raw`x=x_0\cos(\omega t)+\frac{v_0}{\omega}\sin(\omega t)`, String.raw`\dot x=-\omega x_0\sin(\omega t)+v_0\cos(\omega t)`, String.raw`\ddot x=-\omega^2x`], usage: 'Playback and seeking evaluate the same deterministic formula.', sources },
  { id: 'oscillator-derivatives', group: 'Initial conditions and derivatives', title: 'Sine, cosine, and the chain rule', description: 'Differentiating the phase contributes a factor of angular frequency.', tex: [String.raw`\frac{d}{dt}\sin(\omega t)=\omega\cos(\omega t)`, String.raw`\frac{d}{dt}\cos(\omega t)=-\omega\sin(\omega t)`], usage: 'These identities give velocity and acceleration from position.', sources },
  { id: 'oscillator-amplitude', group: 'Initial conditions and derivatives', title: 'Amplitude includes the initial velocity', description: 'Both terms contribute to the peak displacement.', tex: [String.raw`A=\sqrt{x_0^2+(v_0/\omega)^2}`, String.raw`\sin^2u+\cos^2u=1`], usage: 'The scene scales to fit this amplitude; dragging sets a new release position.', sources },
  { id: 'oscillator-energy', group: 'Energy', title: 'Conserved mechanical energy', description: 'Kinetic and spring potential energy exchange without loss.', tex: [String.raw`K=\tfrac12m\dot x^2,\quad U=\tfrac12kx^2,\quad E=K+U`, String.raw`E=\tfrac12mv_0^2+\tfrac12kx_0^2`, String.raw`\frac{dE}{dt}=\dot x(m\ddot x+kx)=0`], usage: 'The energy derivative provides an independent equation check.', sources },
]

export const oscillatorModel = defineSimulation({
  id: 'oscillator', title: 'Harmonic oscillator', eyebrow: 'PERIODIC MOTION',
  description: 'One mass, one spring, and an exchange of energy.',
  interactionHint: 'Drag the block to choose its initial position; initial velocity stays as set. With the block focused, use arrow keys; Home and End choose the position limits.',
  defaults,
  controls: [
    { key: 'mass', label: 'Mass', symbol: 'm', unit: 'kg', min: 0.1, max: 10, step: 0.1 },
    { key: 'spring', label: 'Spring stiffness', symbol: 'k', unit: 'N/m', min: 0.1, max: 80, step: 0.1 },
    { key: 'release', label: 'Initial position', symbol: 'x₀', unit: 'm', min: -0.4, max: 0.4, step: 0.01 },
    { key: 'initialVelocity', label: 'Initial velocity', symbol: 'v₀', unit: 'm/s', min: -1, max: 1, step: 0.01 },
  ],
  sample: sampleOscillator,
  getPlayback: p => ({ duration: 4 * rhythm(p).period, loop: true, note: 'Four complete periods; repeating returns to the same physical state.' }),
  getReadouts: (_p, s) => [
    { label: 'Position', value: s.x, unit: 'm', tone: 'position' },
    { label: 'Velocity', value: s.velocity, unit: 'm/s', tone: 'velocity' },
    { label: 'Acceleration', value: s.acceleration, unit: 'm/s²', tone: 'force' },
    { label: 'Frequency', value: s.frequency, unit: 'Hz', tone: 'neutral' },
  ],
  plots: [
    { key: 'x', label: 'Position', unit: 'm', tone: 'position' },
    { key: 'velocity', label: 'Velocity', unit: 'm/s', tone: 'velocity' },
    { key: 'acceleration', label: 'Acceleration', unit: 'm/s²', tone: 'force' },
  ],
  Scene: OscillatorScene, Lesson: OscillatorLesson, Details: OscillatorDetails, formulas,
  guides: [
    { title: 'A periodic model', text: 'The oscillator repeats exactly. The playback window spans four periods, then returns to the same state.' },
    { title: 'Choose the initial state', text: 'Drag the block or edit its initial position and velocity. Dragging retains the velocity setting. Position is measured from the dashed equilibrium line.' },
    { title: 'Where the numbers come from', text: 'All values are SI units. This is an original generic starter example with illustrative defaults, not a transcription of a supplied lesson.' },
  ],
})
