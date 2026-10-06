import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App'
import { FormulaLibrary } from '../src/framework/FormulaLibrary'
import { TimeSeriesChart } from '../src/framework/TimeSeriesChart'
import { defineSimulation } from '../src/framework/model'
import type { SimulationDefinition } from '../src/framework/types'
import { models } from '../src/models'

function fixture(id = 'third-model'): SimulationDefinition {
  return defineSimulation({
    id, title: 'Third registered model', description: 'An independent extension.',
    defaults: { level: 3 },
    controls: [{ key: 'level', label: 'Level', min: 0, max: 10, step: 0.1 }],
    sample: vi.fn((p, time) => ({ level: p.level + time })),
    getPlayback: () => ({ duration: 5, loop: false }),
    getReadouts: (_p, s) => [{ label: 'Level', value: s.level }],
    Scene: () => <div>Custom scene</div>, Lesson: () => <aside>Custom lesson</aside>,
    formulas: [
      { id: 'first', group: 'Energy | Rates', title: 'Stored value', description: 'A shared concept.', tex: ['E=x^2'] },
      { id: 'second', group: 'Energy | Rates', title: 'Rate of change', description: 'A shared concept.', tex: [String.raw`\dot E=2x\dot x`] },
    ],
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('public model extension rendering', () => {
  it('renders an arbitrary formula group containing a pipe without truncation or duplicate sections', () => {
    const model = fixture()
    const html = renderToStaticMarkup(<FormulaLibrary models={[model]} activeId={model.id} query="" onModel={() => {}} />)
    expect(html).toContain('<h4>Energy | Rates</h4>')
    expect(html.match(/<h4>Energy \| Rates<\/h4>/g)).toHaveLength(1)
    expect(html).toContain('Stored value')
    expect(html).toContain('Rate of change')
  })

  it('keeps identical pipe-containing group names separated when search spans registered models', () => {
    const first = fixture('first-model')
    const second = { ...fixture('second-model'), title: 'Another independent model' }
    const html = renderToStaticMarkup(<FormulaLibrary models={[first, second]} activeId={first.id} query="shared" onModel={() => {}} />)
    expect(html.match(/<h4>Energy \| Rates<\/h4>/g)).toHaveLength(2)
    expect(html).toContain('4 matching topics')
    expect(html).toContain('<span class="eyebrow">Another independent model</span>')
  })

  it('does not sample a model that opted out of shared plots', () => {
    const model = fixture()
    const html = renderToStaticMarkup(<TimeSeriesChart model={model} parameters={model.defaults} snapshot={{ level: 3 }} time={0} duration={5} onSeek={() => {}} />)
    expect(html).toBe('')
    expect(model.sample).not.toHaveBeenCalled()
  })

  it.each([0, -2, NaN, Infinity])('does not sample an invalid plot window (%s)', (duration) => {
    const model = { ...fixture(), plots: [{ key: 'level', label: 'Level' }] }
    const html = renderToStaticMarkup(<TimeSeriesChart model={model} parameters={model.defaults} snapshot={{ level: 3 }} time={0} duration={duration} onSeek={() => {}} />)
    expect(html).toBe('')
    expect(model.sample).not.toHaveBeenCalled()
  })
})

describe('browser starter initial rendering', () => {
  it.each(models)('renders registered $id with only URL data and no DOM or storage', (model) => {
    // The starter reads browser URL data; server rendering needs no browser implementation.
    vi.stubGlobal('location', { search: `?model=${model.id}`, href: `http://localhost/?model=${model.id}` })
    vi.stubGlobal('localStorage', undefined)
    const html = renderToStaticMarkup(<App />)
    expect(html).toContain(`<h1>${model.title}</h1>`)
    expect(html).toContain('aria-label="Simulation playback"')
    expect(html).not.toMatch(/\b(?:NaN|Infinity)\b/)
  })
})
