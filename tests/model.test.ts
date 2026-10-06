import { describe, expect, it } from 'vitest'
import { createSessions, defineSimulation, resolveModelId, sanitizeParameters, validateRegistry } from '../src/framework/model'
import type { SimulationDefinition } from '../src/framework/types'

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
