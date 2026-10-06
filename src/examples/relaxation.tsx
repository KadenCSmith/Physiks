import { useId } from 'react'
import { defineSimulation } from '../framework/model'
import { MathFormula } from '../framework/Math'
import { useNumberFormat } from '../framework/formatting'
import type { FormulaEntry, NumericParameters, SimulationLessonProps, SimulationSceneProps } from '../framework/types'
import './examples.css'

const defaults = { initial: 0.9, target: 0.2, rate: 0.6 }

export function sampleRelaxation(p: NumericParameters, time: number) {
  const t = Number.isFinite(time) ? Math.max(0, time) : 0
  const error = (p.initial - p.target) * Math.exp(-p.rate * t)
  return {
    time: t, value: t === 0 ? p.initial : p.target + error, target: p.target, error,
    derivative: error === 0 ? 0 : -p.rate * error,
    timeConstant: 1 / p.rate,
    halfLife: Math.LN2 / p.rate,
  }
}

function RelaxationScene({ parameters: p, snapshot: s, display }: SimulationSceneProps) {
  const { format: n } = useNumberFormat()
  const sceneId = useId()
  const top = 65
  const bottom = 323
  const height = bottom - top
  const y = bottom - height * s.value
  const targetY = bottom - height * p.target
  return <svg className="example-scene relaxation-scene" viewBox="0 0 760 400" role="img" aria-labelledby={`${sceneId}-title`} aria-describedby={`${sceneId}-desc`}>
    <title id={`${sceneId}-title`}>A normalized value approaches its target</title>
    <desc id={`${sceneId}-desc`}>Current value {n(s.value)}, target {n(p.target)}. The shaded height represents the current value on a zero-to-one scale.</desc>
    <rect className="example-vessel" x="282" y={top} width="126" height={height} rx="5" />
    <rect className="example-level" x="286" y={y} width="118" height={Math.max(0, bottom - y - 3)} />
    <line className="example-level-surface" x1="285" x2="405" y1={y} y2={y} />
    <line className="example-ruler" x1="447" y1={top} x2="447" y2={bottom} />
    {[0, 0.25, 0.5, 0.75, 1].map(value => <g key={value}>
      <line className="example-ruler" x1="444" x2="454" y1={bottom - value * height} y2={bottom - value * height} />
      {display.labels && <text className="example-scene-label" x="466" y={bottom - value * height + 4}>{n(value)}</text>}
    </g>)}
    <line className="example-target-line" x1="251" x2="436" y1={targetY} y2={targetY} />
    <circle className="example-value-point" cx="447" cy={y} r="6" />
    {display.labels && <>
      <text className="example-scene-label" x="345" y="41" textAnchor="middle">NORMALIZED VALUE</text>
      <text className="example-target-text" x="235" y={targetY + 4} textAnchor="end">target {n(p.target)}</text>
      <text className="example-scene-value" x="345" y="354" textAnchor="middle">y = {n(s.value)}</text>
      <text className="example-scene-label" x="345" y="376" textAnchor="middle">{s.error > 0 ? 'APPROACHING FROM ABOVE' : s.error < 0 ? 'APPROACHING FROM BELOW' : 'AT EQUILIBRIUM'}</text>
    </>}
  </svg>
}

function RelaxationLesson({ parameters: p, snapshot: s, time }: SimulationLessonProps) {
  const { format: n } = useNumberFormat()
  return <section className="example-lesson" aria-label="Exponential relaxation equations">
    <header><span className="example-eyebrow">THE EQUATION / t = {n(time)} s</span><h2>Close the remaining gap.</h2></header>
    <div className="example-equation-card">
      <MathFormula tex={String.raw`\frac{dy}{dt}=-r(y-y_\ast)`} />
      <div className="example-factor-grid">
        <div><span>Current value · y</span><output>{n(s.value)}</output></div>
        <div><span>Target · y*</span><output>{n(p.target)}</output></div>
        <div><span>Rate constant · r</span><output>{n(p.rate)} <small>s⁻¹</small></output></div>
        <div><span>Rate of change · dy/dt</span><output>{n(s.derivative)} <small>s⁻¹</small></output></div>
      </div>
      <div className="example-live-equation" aria-label="Live substituted rate equation">
        <span className="example-substitution"><output>{n(s.derivative)}</output><small>dy/dt</small></span>
        <span>≈ −</span>
        <span className="example-substitution"><output>{n(p.rate)}</output><small>r</small></span>
        <span>× (</span>
        <span className="example-substitution"><output>{n(s.value)}</output><small>y</small></span>
        <span>−</span>
        <span className="example-substitution"><output>{n(p.target)}</output><small>y*</small></span>
        <span>) s⁻¹</span>
      </div>
      <p>The rate of change is proportional to the remaining gap. It is negative above the target and positive below it. At the target, it is zero.</p>
    </div>
    <div className="example-equation-card">
      <MathFormula tex={String.raw`y(t)=y_\ast+(y_0-y_\ast)e^{-rt}`} />
      <div className="example-live-equation" aria-label="Response with current parameter values">
        <span>y(t) ≈</span>
        <span className="example-substitution"><output>{n(p.target)}</output><small>y*</small></span>
        <span>+</span>
        <span className="example-substitution"><output>({n(p.initial - p.target)})</output><small>y₀ − y*</small></span>
        <span>exp(−</span>
        <span className="example-substitution"><output>{n(p.rate)}</output><small>r</small></span>
        <span>t)</span>
      </div>
      <p>The initial gap shrinks exponentially. The response approaches the target without overshooting, and it does not repeat.</p>
      <dl className="example-metrics"><div><dt>Time constant · τ = 1/r</dt><dd>{n(s.timeConstant)} s</dd></div><div><dt>Gap half-life · ln(2)/r</dt><dd>{n(s.halfLife)} s</dd></div></dl>
    </div>
    <details className="example-detail"><summary>Derive the exponential response</summary><div>
      <MathFormula tex={String.raw`e=y-y_\ast,\qquad\dot e=-re`} />
      <MathFormula tex={String.raw`e(t)=e_0e^{-rt},\qquad\frac{d}{dt}e^{-rt}=-re^{-rt}`} />
      <p>The target is constant, so the derivative of the gap equals the derivative of the value. The exponential has exactly the proportional derivative required by the equation.</p>
    </div></details>
    <details className="example-detail"><summary>Read the time scales</summary><div>
      <MathFormula tex={String.raw`\frac{|e(\tau)|}{|e_0|}=e^{-1},\qquad\tau=\frac1r`} />
      <p>The remaining gap after one time constant is approximately {n(Math.exp(-1))} of its initial magnitude.</p>
      <MathFormula tex={String.raw`e^{-rt_{1/2}}=\frac12\quad\Longrightarrow\quad t_{1/2}=\frac{\ln2}{r}`} />
      <p>One time constant removes about {n(100 * (1 - Math.exp(-1)))}% of the initial gap. One half-life halves it. After the five-time-constant playback window, about {n(100 * Math.exp(-5))}% remains. These ratios apply when the initial gap is nonzero.</p>
    </div></details>
  </section>
}

function RelaxationDetails() {
  return <div className="example-supporting-notes"><h3>Try approaching from either side.</h3><p>Move the target above the initial value to watch a rise, then below it to watch a decay. A larger rate constant shortens both the time constant and half-life.</p><p>The displayed level is a dimensionless scalar, not a fluid model. This example contains no force law, overshoot, or oscillation. If initial and target values match, it stays at equilibrium.</p></div>
}

const sources = ['Original exponential-relaxation starter example; derived from a first-order linear differential equation.']
const formulas: FormulaEntry[] = [
  { id: 'relaxation-equation', group: 'Rate and equilibrium', title: 'Rate is proportional to the gap', description: 'A positive rate constant drives the current value toward a fixed target.', tex: [String.raw`\dot y=-r(y-y_\ast),\qquad r>0`, String.raw`y=y_\ast\quad\Longrightarrow\quad\dot y=0`], usage: 'The rate has the opposite sign to the remaining gap.', sources },
  { id: 'relaxation-response', group: 'Rate and equilibrium', title: 'Analytical response from the initial value', description: 'The value remains between the initial value and its target for all nonnegative time.', tex: [String.raw`y(t)=y_\ast+(y_0-y_\ast)e^{-rt}`, String.raw`y(0)=y_0,\qquad\lim_{t\to\infty}y(t)=y_\ast`], usage: 'A constant target and rate produce a nonperiodic, monotonic response.', sources },
  { id: 'relaxation-derivative', group: 'Derivation and derivatives', title: 'Differentiate using the chain rule', description: 'The exponent contributes a factor of negative r.', tex: [String.raw`\frac{d}{dt}e^{-rt}=-re^{-rt}`, String.raw`\dot y=-r(y_0-y_\ast)e^{-rt}=-r(y-y_\ast)`], usage: 'Differentiation verifies that the analytical response satisfies the rate equation.', sources },
  { id: 'relaxation-separation', group: 'Derivation and derivatives', title: 'Separate the equation for the gap', description: 'Let e denote the signed gap rather than the exponential base.', tex: [String.raw`e=y-y_\ast,\qquad\frac{de}{dt}=-re`, String.raw`\ln\left|\frac{e(t)}{e_0}\right|=-rt`, String.raw`e(t)=e_0\exp(-rt)`], usage: 'The logarithmic step requires a nonzero initial gap. If the initial gap is zero, the equilibrium solution follows directly.', sources },
  { id: 'relaxation-time-constant', group: 'Time scales', title: 'One time constant', description: 'A time constant reduces the initial nonzero gap to one over e of its initial magnitude.', tex: [String.raw`\tau=1/r`, String.raw`|e(\tau)|=|e_0|\exp(-1)`], usage: 'Rate is in inverse seconds; time constant is in seconds. The live lesson shows its decimal approximation using the selected display precision.', sources },
  { id: 'relaxation-half-life', group: 'Time scales', title: 'Half-life of the remaining gap', description: 'Solve for the time needed to halve a nonzero initial gap.', tex: [String.raw`\exp(-rt_{1/2})=\tfrac12`, String.raw`t_{1/2}=\ln(2)/r`], usage: 'Each half-life halves the remaining gap again; it does not subtract a fixed amount.', sources },
  { id: 'relaxation-window', group: 'Time scales', title: 'A finite view of a nonperiodic response', description: 'The infinite asymptotic process is shown over five time constants.', tex: [String.raw`t_{\mathrm{view}}=5/r`, String.raw`|e(5/r)|=|e_0|\exp(-5)`], usage: 'Playback stops at the end instead of looping and inventing a reset in the physical process. The live lesson shows the remaining percentage using the selected display precision.', sources },
]

export const relaxationModel = defineSimulation({
  id: 'relaxation', title: 'Exponential relaxation', eyebrow: 'NONPERIODIC CHANGE',
  description: 'A changing value approaches a fixed target.',
  interactionHint: 'Change the initial value, target, or rate. The dotted line marks the target; the point follows the current value.',
  defaults,
  controls: [
    { key: 'initial', label: 'Initial value', symbol: 'y₀', min: 0.1, max: 1, step: 0.01, note: 'Dimensionless value on a zero-to-one scale.' },
    { key: 'target', label: 'Target value', symbol: 'y*', min: 0, max: 1, step: 0.01 },
    { key: 'rate', label: 'Rate constant', symbol: 'r', unit: 's⁻¹', min: 0.05, max: 2, step: 0.05 },
  ],
  sample: sampleRelaxation,
  getPlayback: p => ({ duration: 5 / p.rate, loop: false, note: 'Five time constants; a nonzero initial gap continues shrinking beyond the observation window.' }),
  getReadouts: (_p, s) => [
    { label: 'Current value', value: s.value, tone: 'position' },
    { label: 'Rate of change', value: s.derivative, unit: 's⁻¹', tone: 'velocity' },
    { label: 'Target', value: s.target, tone: 'neutral' },
    { label: 'Gap half-life', value: s.halfLife, unit: 's', tone: 'neutral' },
  ],
  plots: [
    { key: 'value', label: 'Current value', tone: 'position' },
    { key: 'derivative', label: 'Rate of change', unit: 's⁻¹', tone: 'velocity' },
  ],
  Scene: RelaxationScene, Lesson: RelaxationLesson, Details: RelaxationDetails, formulas,
  guides: [
    { title: 'A nonperiodic model', text: 'The response approaches its target and never repeats. Playback ends after five time constants; seeking can revisit any point in that window.' },
    { title: 'A normalized value', text: 'The vertical display represents a dimensionless value from zero to one. It is not a tank or fluid simulation, and no force vectors apply.' },
    { title: 'Where the numbers come from', text: 'This is an original generic starter example of a first-order rate equation. Its illustrative defaults do not come from a supplied lesson or source document.' },
  ],
})
