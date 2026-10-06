import katex from 'katex'
import { describe, expect, it } from 'vitest'
import { appConfig } from '../src/app.config'
import { models } from '../src/models'
import { validateAppConfig, validateModelSamples, validateRegistry } from '../src/framework/model'

/** This is also the check:models command: new registrations are included automatically. */
describe('registered model health', () => {
  it('connects app configuration to a consistent model registry', () => {
    expect(() => validateRegistry(models)).not.toThrow()
    expect(() => validateAppConfig(appConfig, models)).not.toThrow()
  })

  it.each(models)('$id provides usable playback, numeric state, readouts, plots, and formulas at control boundaries', model => {
    const report = validateModelSamples(model, {
      validateTex: tex => { katex.renderToString(tex, { throwOnError: true, trust: false }) },
    })
    expect(report.modelId).toBe(model.id)
    expect(report.samplePoints).toBeGreaterThanOrEqual(3)
  })
})
