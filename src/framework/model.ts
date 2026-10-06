import type { NumericParameters, SimulationDefinition } from './types'

const modelIdPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const parameterKeyPattern = /^[A-Za-z][A-Za-z0-9_]*$/
const reservedKeys = new Set(['__proto__', 'prototype', 'constructor'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Persisted input is optional data; inherited fields and inaccessible properties are ignored. */
function ownValue(value: unknown, key: string): unknown {
  if (!isRecord(value)) return undefined
  try {
    return Object.prototype.hasOwnProperty.call(value, key) ? value[key] : undefined
  } catch {
    return undefined
  }
}

/** Fail early for developer configuration errors rather than rendering unsafe controls. */
export function validateRegistry(models: readonly SimulationDefinition[]): void {
  const errors: string[] = []
  const ids = new Set<string>()
  if (models.length === 0) errors.push('Register at least one simulation.')
  models.forEach((model, index) => {
    const label = typeof model.id === 'string' && model.id ? model.id : `model ${index + 1}`
    if (typeof model.id !== 'string' || !modelIdPattern.test(model.id) || reservedKeys.has(model.id)) {
      errors.push(`${label}: id must be a lowercase kebab name, such as "spring-motion".`)
    }
    if (ids.has(model.id)) errors.push(`${label}: duplicate model id.`)
    ids.add(model.id)
    if (!isRecord(model.defaults)) {
      errors.push(`${label}: defaults must be a numeric parameter record.`)
      return
    }
    if (!Array.isArray(model.controls)) {
      errors.push(`${label}: controls must be an array.`)
      return
    }
    const keys = new Set<string>()
    model.controls.forEach((control) => {
      const key = control.key
      if (typeof key !== 'string' || !parameterKeyPattern.test(key) || reservedKeys.has(key)) {
        errors.push(`${label}: parameter keys must be safe named identifiers.`)
      }
      if (keys.has(key)) errors.push(`${label}.${key}: duplicate control key.`)
      keys.add(key)
      if (!Number.isFinite(control.min) || !Number.isFinite(control.max) || control.min > control.max) {
        errors.push(`${label}.${key}: min and max must be finite, with min <= max.`)
      }
      if (!Number.isFinite(control.step) || control.step <= 0) {
        errors.push(`${label}.${key}: step must be positive and finite.`)
      }
      const defaultValue = ownValue(model.defaults, key)
      if (typeof defaultValue !== 'number' || !Number.isFinite(defaultValue)) {
        errors.push(`${label}.${key}: provide a finite numeric default.`)
      } else if (defaultValue < control.min || defaultValue > control.max) {
        errors.push(`${label}.${key}: default must lie between min and max.`)
      }
    })
    Object.keys(model.defaults).forEach((key) => {
      if (!keys.has(key)) errors.push(`${label}.${key}: every default must have a matching control.`)
    })
  })
  if (errors.length) throw new Error(`Invalid simulation registry:\n${errors.join('\n')}`)
}

/** Validate a definition while retaining its inferred component/function types. */
export function defineSimulation<T extends SimulationDefinition>(model: T): T {
  validateRegistry([model])
  return model
}

/** Only declared keys survive. Finite values clamp to bounds without rounding to slider steps. */
export function sanitizeParameters(model: SimulationDefinition, input: unknown): NumericParameters {
  validateRegistry([model])
  return Object.fromEntries(model.controls.map((control) => {
    const saved = ownValue(input, control.key)
    const value = typeof saved === 'number' && Number.isFinite(saved) ? saved : model.defaults[control.key]
    return [control.key, Math.min(control.max, Math.max(control.min, value))]
  }))
}

/** Recover registered sessions from old or malformed storage without importing stale models. */
export function createSessions(models: readonly SimulationDefinition[], saved: unknown): Record<string, NumericParameters> {
  validateRegistry(models)
  return Object.fromEntries(models.map((model) => [model.id, sanitizeParameters(model, ownValue(saved, model.id))]))
}

/** Prefer the requested model, then a registered configured fallback, then the first model. */
export function resolveModelId(models: readonly SimulationDefinition[], id: unknown, fallback?: string): string {
  validateRegistry(models)
  if (typeof id === 'string' && models.some((model) => model.id === id)) return id
  if (typeof fallback === 'string' && models.some((model) => model.id === fallback)) return fallback
  return models[0].id
}
