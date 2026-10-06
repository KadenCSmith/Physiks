import type { AppConfig, NumericParameters, NumericSnapshot, SimulationDefinition } from './types'

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
    const labels = new Set<string>()
    model.controls.forEach((control) => {
      const key = control.key
      if (typeof key !== 'string' || !parameterKeyPattern.test(key) || reservedKeys.has(key)) {
        errors.push(`${label}: parameter keys must be safe named identifiers.`)
      }
      if (keys.has(key)) errors.push(`${label}.${key}: duplicate control key.`)
      keys.add(key)
      const controlLabel = typeof control.label === 'string' ? control.label.trim().toLowerCase() : ''
      if (!controlLabel) errors.push(`${label}.${key}: provide a nonempty control label.`)
      else if (labels.has(controlLabel)) errors.push(`${label}.${key}: duplicate control label "${control.label}".`)
      labels.add(controlLabel)
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
    const formulaIds = new Set<string>()
    if (!Array.isArray(model.formulas)) errors.push(`${label}: formulas must be an array, even when empty.`)
    else model.formulas.forEach((formula) => {
      const id = typeof formula.id === 'string' ? formula.id.trim() : ''
      if (!id) errors.push(`${label}: every formula needs a nonempty id.`)
      else if (formulaIds.has(id)) errors.push(`${label}.formulas.${id}: duplicate formula id.`)
      formulaIds.add(id)
      if (!Array.isArray(formula.tex) || formula.tex.some(tex => typeof tex !== 'string' || !tex.trim())) {
        errors.push(`${label}.formulas.${id || '(missing id)'}: tex must be an array of nonempty strings.`)
      }
    })
    const plotKeys = new Set<string>()
    model.plots?.forEach((plot) => {
      if (plotKeys.has(plot.key)) errors.push(`${label}.plots.${plot.key}: duplicate plotted key.`)
      plotKeys.add(plot.key)
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

/** Validate the app-level choices that connect configuration to a registered model. */
export function validateAppConfig(config: AppConfig, models: readonly SimulationDefinition[]): void {
  validateRegistry(models)
  const errors: string[] = []
  if (typeof config.id !== 'string' || !modelIdPattern.test(config.id) || reservedKeys.has(config.id)) {
    errors.push('id must be a safe lowercase kebab name for the storage namespace.')
  }
  if (!models.some(model => model.id === config.defaultModelId)) {
    errors.push(`defaultModelId "${config.defaultModelId}" is not registered.`)
  }
  if (!Number.isFinite(config.defaultSpeed) || config.defaultSpeed <= 0) {
    errors.push('defaultSpeed must be positive and finite.')
  }
  if (errors.length) throw new Error(`Invalid app configuration "${config.id}":\n${errors.join('\n')}`)
}

export interface ModelHealthOptions {
  /** Supply a math parser here in tests/tools; the runtime itself does not depend on one. */
  validateTex?: (tex: string) => void
}

export interface ModelHealthReport {
  modelId: string
  parameterCases: number
  samplePoints: number
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Check extension contracts at defaults and each individual control endpoint.
 * This intentionally avoids a Cartesian product of all parameter extremes or physics assumptions.
 */
export function validateModelSamples(model: SimulationDefinition, options: ModelHealthOptions = {}): ModelHealthReport {
  validateRegistry([model])
  const errors: string[] = []
  const cases: { name: string; parameters: NumericParameters }[] = []
  const seen = new Set<string>()
  const addCase = (name: string, parameters: NumericParameters) => {
    const serialized = JSON.stringify(parameters)
    if (seen.has(serialized)) return
    seen.add(serialized)
    cases.push({ name, parameters })
  }
  addCase('defaults', { ...model.defaults })
  model.controls.forEach(control => {
    addCase(`${control.key}=min (${control.min})`, { ...model.defaults, [control.key]: control.min })
    addCase(`${control.key}=max (${control.max})`, { ...model.defaults, [control.key]: control.max })
  })
  if (options.validateTex) model.formulas.forEach(formula => formula.tex.forEach((tex, index) => {
    try { options.validateTex!(tex) }
    catch (error) { errors.push(`${model.id}.formulas.${formula.id}.tex[${index}]: ${failureMessage(error)}`) }
  }))
  let samplePoints = 0
  cases.forEach(({ name, parameters }) => {
    const context = `${model.id} [${name}]`
    let playback: unknown
    try { playback = model.getPlayback({ ...parameters }) }
    catch (error) { errors.push(`${context} getPlayback: ${failureMessage(error)}`); return }
    if (!isRecord(playback) || typeof playback.duration !== 'number'
      || !Number.isFinite(playback.duration) || playback.duration <= 0) {
      errors.push(`${context} getPlayback.duration: expected a positive finite number.`)
      return
    }
    if (typeof playback.loop !== 'boolean') errors.push(`${context} getPlayback.loop: expected a boolean.`)
    if (playback.disabled !== undefined && typeof playback.disabled !== 'boolean') {
      errors.push(`${context} getPlayback.disabled: expected a boolean when provided.`)
    }
    const duration = playback.duration
    ;[0, duration / 2, duration].forEach(time => {
      samplePoints++
      const point = `${context} t=${time}`
      const input = { ...parameters }
      let snapshot: unknown
      try { snapshot = model.sample(input, time) }
      catch (error) { errors.push(`${point} sample: ${failureMessage(error)}`); return }
      if (Object.keys(input).length !== Object.keys(parameters).length
        || Object.keys(parameters).some(key => input[key] !== parameters[key])) {
        errors.push(`${point} sample: must not mutate parameter values.`)
      }
      if (!isRecord(snapshot)) { errors.push(`${point} sample: expected a numeric snapshot record.`); return }
      let finiteSnapshot = true
      Object.entries(snapshot).forEach(([key, value]) => {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          finiteSnapshot = false
          errors.push(`${point} snapshot.${key}: expected a finite number.`)
        }
      })
      model.plots?.forEach(plot => {
        if (!Object.prototype.hasOwnProperty.call(snapshot, plot.key)) {
          errors.push(`${point} plots.${plot.key}: key is missing from the snapshot.`)
        }
      })
      if (!finiteSnapshot) return
      const numeric = snapshot as NumericSnapshot
      if (name === 'defaults') {
        try {
          const repeated: unknown = model.sample({ ...parameters }, time)
          if (!isRecord(repeated) || Object.keys(numeric).length !== Object.keys(repeated).length
            || Object.keys(numeric).some(key => repeated[key] !== numeric[key])) {
            errors.push(`${point} sample: repeated evaluation must return the same numeric state.`)
          }
        } catch (error) { errors.push(`${point} repeated sample: ${failureMessage(error)}`) }
      }
      let readouts: unknown
      try { readouts = model.getReadouts({ ...parameters }, { ...numeric }) }
      catch (error) { errors.push(`${point} getReadouts: ${failureMessage(error)}`); return }
      if (!Array.isArray(readouts)) { errors.push(`${point} getReadouts: expected an array.`); return }
      readouts.forEach((readout: unknown, index: number) => {
        if (!isRecord(readout)) { errors.push(`${point} readouts[${index}]: expected a labeled numeric value.`); return }
        if (typeof readout.label !== 'string' || !readout.label.trim()) {
          errors.push(`${point} readouts[${index}].label: expected a nonempty label.`)
        }
        if (typeof readout.value !== 'number' || !Number.isFinite(readout.value)) {
          errors.push(`${point} readout "${readout.label}".value: expected a finite number.`)
        }
      })
    })
  })
  if (errors.length) throw new Error(`Model health check failed:\n${errors.join('\n')}`)
  return { modelId: model.id, parameterCases: cases.length, samplePoints }
}
