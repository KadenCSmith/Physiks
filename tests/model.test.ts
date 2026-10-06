import { describe, expect, it } from 'vitest'
import { createSessions, defineSimulation, resolveModelId, sanitizeParameters, validateAppConfig, validateModelSamples, validateRegistry } from '../src/framework/model'
import type { AppConfig, NumericSnapshot, SimulationDefinition } from '../src/framework/types'

function fixture(id = 'example'): SimulationDefinition {
  return {
    id, title: 'Example', description: 'A test model.',
    defaults: { position: 0.5, rate: 2 },
    controls: [
      { key: 'position', label: 'Position', min: -1, max: 1, step: 0.25 },
      { key: 'rate', label: 'Rate', min: 0, max: 10, step: 1 },
    ],
    sample: (p, t) => ({ value: p.position + p.rate * t }),
    getPlayback: () => ({ duration: 4, loop: false }),
    getReadouts: (_p, s) => [{ label: 'Value', value: s.value }],
    Scene: () => null, Lesson: () => null, formulas: [],
  }
}

describe('simulation registration', () => {
  it('accepts consistent definitions and preserves the original model and functions', () => {
    const model = fixture('spring-motion')
    expect(defineSimulation(model)).toBe(model)
    expect(() => validateRegistry([model, fixture('second-example')])).not.toThrow()
  })

  it('rejects empty registries, stale duplicate IDs, and unsafe or malformed IDs', () => {
    expect(() => validateRegistry([])).toThrow(/at least one/)
    expect(() => validateRegistry([fixture(), fixture()])).toThrow(/duplicate model id/)
    for (const id of ['', 'Two Words', 'mixedCase', 'bad--id', '-leading', 'trailing-', '__proto__', 'constructor']) {
      expect(() => defineSimulation(fixture(id))).toThrow(/id must/)
    }
  })

  it('requires one matching control for every default, without duplicate or reserved parameter keys', () => {
    const model = fixture()
    expect(() => defineSimulation({ ...model, controls: model.controls.slice(0, 1) })).toThrow(/matching control/)
    expect(() => defineSimulation({ ...model, defaults: { position: 0.5 } })).toThrow(/finite numeric default/)
    expect(() => defineSimulation({ ...model, controls: [...model.controls, model.controls[0]] })).toThrow(/duplicate control key/)
    expect(() => defineSimulation({
      ...model, defaults: { constructor: 1 }, controls: [{ key: 'constructor', label: 'Unsafe', min: 0, max: 2, step: 1 }],
    })).toThrow(/safe named identifiers/)
  })

  it('rejects nonfinite defaults, invalid ranges, and unsupported control steps', () => {
    for (const value of [NaN, Infinity, -Infinity, -2, 2]) {
      expect(() => defineSimulation({ ...fixture(), defaults: { position: value, rate: 2 } })).toThrow(/default/)
    }
    for (const bounds of [
      { min: Infinity }, { max: NaN }, { min: 2, max: 1 },
      { step: 0 }, { step: -1 }, { step: Infinity },
    ]) {
      const model = fixture()
      expect(() => defineSimulation({ ...model, controls: [{ ...model.controls[0], ...bounds }, model.controls[1]] })).toThrow()
    }
  })

  it('supports a fixed-value control and a model without editable numeric values', () => {
    const model = fixture()
    expect(() => defineSimulation({
      ...model, defaults: { constant: 2 }, controls: [{ key: 'constant', label: 'Constant', min: 2, max: 2, step: 1 }],
    })).not.toThrow()
    expect(() => defineSimulation({ ...model, defaults: {}, controls: [] })).not.toThrow()
  })

  it('rejects ambiguous control labels and unstable duplicate formula or plot identities', () => {
    const model = fixture()
    expect(() => defineSimulation({ ...model, controls: [model.controls[0], { ...model.controls[1], label: ' position ' }] })).toThrow(/duplicate control label/)
    expect(() => defineSimulation({ ...model, controls: [{ ...model.controls[0], label: '' }, model.controls[1]] })).toThrow(/nonempty control label/)
    const formula = { id: 'shared', group: 'Example', title: 'Equation', description: 'Explanation', tex: ['x=t'] }
    expect(() => defineSimulation({ ...model, formulas: [formula, { ...formula, title: 'Another' }] })).toThrow(/duplicate formula id/)
    expect(() => defineSimulation({ ...model, formulas: [{ ...formula, id: ' ' }] })).toThrow(/nonempty id/)
    expect(() => defineSimulation({ ...model, formulas: [{ ...formula, tex: [''] }] })).toThrow(/nonempty strings/)
    expect(() => defineSimulation({ ...model, plots: [{ key: 'value', label: 'First' }, { key: 'value', label: 'Second' }] })).toThrow(/duplicate plotted key/)
  })
})

describe('actionable model health checks', () => {
  it('checks defaults and independent control boundaries without a combinatorial parameter grid', () => {
    const seen = new Set<string>()
    const model = fixture()
    const sample = model.sample
    model.sample = (parameters, time) => { seen.add(JSON.stringify(parameters)); return sample(parameters, time) }
    const report = validateModelSamples(model)
    expect(report).toEqual({ modelId: model.id, parameterCases: 5, samplePoints: 15 })
    expect([...seen].map(value => JSON.parse(value))).toEqual(expect.arrayContaining([
      { position: 0.5, rate: 2 }, { position: -1, rate: 2 }, { position: 1, rate: 2 },
      { position: 0.5, rate: 0 }, { position: 0.5, rate: 10 },
    ]))
    expect(seen.size).toBe(5)
  })

  it('identifies the offending model, control boundary, and playback field', () => {
    const model = fixture('bad-window')
    model.getPlayback = parameters => ({ duration: parameters.position === -1 ? Infinity : 4, loop: false })
    expect(() => validateModelSamples(model)).toThrow(/bad-window \[position=min \(-1\)\] getPlayback.duration: expected a positive finite number/)
  })

  it('names nonfinite snapshot and readout values at their sampled time', () => {
    const badSnapshot = fixture('bad-state')
    badSnapshot.sample = (_parameters, time) => ({ value: time === 4 ? NaN : 0 })
    expect(() => validateModelSamples(badSnapshot)).toThrow(/bad-state \[defaults\] t=4 snapshot.value: expected a finite number/)
    const badReadout = fixture('bad-readout')
    badReadout.getReadouts = () => [{ label: 'Measurement', value: Infinity }]
    expect(() => validateModelSamples(badReadout)).toThrow(/bad-readout \[defaults\] t=0 readout "Measurement".value: expected a finite number/)
  })

  it('reports plotted keys that disappear at a boundary and preserves thrown model errors', () => {
    const missing = fixture('missing-plot')
    missing.plots = [{ key: 'value', label: 'Value' }]
    missing.sample = (parameters): NumericSnapshot => parameters.rate === 10 ? {} : { value: 0 }
    expect(() => validateModelSamples(missing)).toThrow(/missing-plot \[rate=max \(10\)\] t=0 plots.value: key is missing/)
    const thrown = fixture('throwing-model')
    thrown.sample = () => { throw new Error('Solver could not converge') }
    expect(() => validateModelSamples(thrown)).toThrow(/throwing-model \[defaults\] t=0 sample: Solver could not converge/)
  })

  it('detects sampling mutations and a nondeterministic response', () => {
    const mutating = fixture('mutating-model')
    mutating.sample = parameters => { parameters.rate++; return { value: 0 } }
    expect(() => validateModelSamples(mutating)).toThrow(/mutating-model \[defaults\] t=0 sample: must not mutate/)
    expect(mutating.defaults).toEqual({ position: 0.5, rate: 2 })
    const random = fixture('varying-model')
    let counter = 0
    random.sample = () => ({ value: counter++ })
    expect(() => validateModelSamples(random)).toThrow(/varying-model \[defaults\] t=0 sample: repeated evaluation must return the same/)
  })

  it('keeps math parsing optional and reports its formula ID and equation index', () => {
    const model = fixture('bad-math')
    model.formulas = [{ id: 'response', title: 'Response', group: 'Motion', description: 'Test', tex: ['valid', 'invalid'] }]
    const checked: string[] = []
    expect(() => validateModelSamples(model, {
      validateTex(tex) { checked.push(tex); if (tex === 'invalid') throw new Error('Unknown command') },
    })).toThrow(/bad-math.formulas.response.tex\[1\]: Unknown command/)
    expect(checked).toEqual(['valid', 'invalid'])
    expect(() => validateModelSamples(model)).not.toThrow()
  })

  it('accepts disabled/static models with a finite window and models without plots or readouts', () => {
    const model = fixture('static-model')
    model.defaults = {}
    model.controls = []
    model.getPlayback = () => ({ duration: 1, loop: false, disabled: true })
    model.sample = () => ({})
    model.getReadouts = () => []
    expect(validateModelSamples(model)).toEqual({ modelId: 'static-model', parameterCases: 1, samplePoints: 3 })
  })
})

describe('configuration connects to the registry', () => {
  const config: AppConfig = {
    id: 'test-app', title: 'Test', shortTitle: 'Test', description: 'Test app', version: '0.1.0',
    switcherLabel: 'Simulation', documentationLabel: 'Reference', defaultSpeed: 0.25, defaultModelId: 'example',
  }

  it('requires a registered initial model and positive finite viewing speed', () => {
    expect(() => validateAppConfig(config, [fixture()])).not.toThrow()
    expect(() => validateAppConfig({ ...config, defaultModelId: 'removed' }, [fixture()])).toThrow(/defaultModelId "removed" is not registered/)
    for (const speed of [0, -1, NaN, Infinity]) {
      expect(() => validateAppConfig({ ...config, defaultSpeed: speed }, [fixture()])).toThrow(/defaultSpeed must be positive and finite/)
    }
    expect(() => validateAppConfig({ ...config, id: 'Unsafe App' }, [fixture()])).toThrow(/storage namespace/)
  })
})

describe('parameter and persisted-session recovery', () => {
  it('clamps finite input without rounding and discards undeclared values', () => {
    const model = fixture()
    expect(sanitizeParameters(model, { position: 0.731234, rate: 200, added: 3 })).toEqual({ position: 0.731234, rate: 10 })
    expect(sanitizeParameters(model, { position: -8, rate: -1 })).toEqual({ position: -1, rate: 0 })
  })

  it('falls back for missing, nonfinite, and nonnumeric input without accepting inherited fields', () => {
    const model = fixture()
    for (const input of [undefined, null, 'old-data', 8, [], { position: Infinity, rate: NaN }, { position: '0.2', rate: true }]) {
      expect(sanitizeParameters(model, input)).toEqual(model.defaults)
    }
    expect(sanitizeParameters(model, Object.create({ position: -0.9, rate: 7 }))).toEqual(model.defaults)
    const inaccessible = Object.defineProperty({}, 'position', { get() { throw new Error('Stale input') } })
    expect(sanitizeParameters(model, inaccessible)).toEqual(model.defaults)
  })

  it('recovers changed model schemas, ignores removed models, and creates independent fresh records', () => {
    const models = [fixture('first'), fixture('second')]
    const saved = { first: { position: 0.7, rate: 20, removedKey: 3 }, removedModel: { position: 1 }, second: null }
    const sessions = createSessions(models, saved)
    expect(sessions).toEqual({ first: { position: 0.7, rate: 10 }, second: { position: 0.5, rate: 2 } })
    sessions.second.position = -1
    expect(models[1].defaults.position).toBe(0.5)
    expect(saved.first.rate).toBe(20)
    expect(createSessions(models, saved).second.position).toBe(0.5)
    expect(createSessions(models, ['invalid-record'])).toEqual({ first: models[0].defaults, second: models[1].defaults })
  })

  it('resolves known model IDs and replaces stale IDs with a registered fallback', () => {
    const models = [fixture('first'), fixture('second')]
    expect(resolveModelId(models, 'second', 'first')).toBe('second')
    expect(resolveModelId(models, 'deleted', 'second')).toBe('second')
    expect(resolveModelId(models, null, 'deleted')).toBe('first')
    expect(resolveModelId(models, undefined)).toBe('first')
    expect(() => resolveModelId([], 'first')).toThrow(/at least one/)
  })
})
