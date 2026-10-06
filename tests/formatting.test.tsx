import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DecimalPlacesControl, NumberFormatProvider, displayPreferencesKey, formatNumber, normalizeDecimalPlaces, readDecimalPlaces, useNumberFormat, writeDecimalPlaces, type DisplayPreferenceStorage } from '../src/framework/formatting'
import { ParameterControl } from '../src/framework/ParameterControl'
import { oscillatorModel, relaxationModel } from '../src/models'
import type { NumericParameters } from '../src/framework/types'

function memoryStorage(initial: Record<string, string> = {}): DisplayPreferenceStorage {
  const values = new Map(Object.entries(initial))
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } }
}

function renderAtPrecision(children: ReactNode, places: number): string {
  const storage = memoryStorage({ [displayPreferencesKey('precision-test')]: JSON.stringify({ decimalPlaces: places }) })
  return renderToStaticMarkup(<NumberFormatProvider appId="precision-test" storage={storage}>{children}</NumberFormatProvider>)
}

describe('display number formatting', () => {
  it('defaults to thousandths and correctly rounds carries and halfway values', () => {
    expect(formatNumber(1.23449)).toBe('1.234')
    expect(formatNumber(1.2345)).toBe('1.235')
    expect(formatNumber(1.9995)).toBe('2')
    expect(formatNumber(-1.2345)).toBe('-1.235')
    expect(formatNumber(2)).toBe('2')
    expect(formatNumber(1.23)).toBe('1.23')
    expect(formatNumber(1.2, 6)).toBe('1.2')
  })

  it('supports every selectable precision including integer display', () => {
    expect(formatNumber(1.23456789, 0)).toBe('1')
    expect(formatNumber(1.23456789, 2)).toBe('1.23')
    expect(formatNumber(1.23456789, 6)).toBe('1.234568')
    expect(formatNumber(0, 6)).toBe('0')
  })

  it('normalizes rounded negative zero without hiding a resolved negative value', () => {
    expect(formatNumber(-0)).toBe('0')
    expect(formatNumber(-0.0004)).toBe('0')
    expect(formatNumber(-0.0005)).toBe('-0.001')
    expect(formatNumber(-0.2, 0)).toBe('0')
  })

  it('handles invalid numbers and large finite values without exposing NaN or Infinity', () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(formatNumber(value)).toBe('—')
    expect(formatNumber(1e22)).toBe('10000000000000000000000')
    for (const places of [-1, 7, 2.5, NaN]) expect(formatNumber(1.23456, places)).toBe('1.235')
  })
})

describe('per-app saved display preference', () => {
  it('preserves zero places and separates independent apps', () => {
    const storage = memoryStorage()
    expect(readDecimalPlaces('one-app', storage)).toBe(3)
    expect(writeDecimalPlaces('one-app', 0, storage)).toBe(true)
    expect(writeDecimalPlaces('another-app', 6, storage)).toBe(true)
    expect(readDecimalPlaces('one-app', storage)).toBe(0)
    expect(readDecimalPlaces('another-app', storage)).toBe(6)
    expect(readDecimalPlaces('new-app', storage)).toBe(3)
  })

  it('falls back safely for stale, malformed, nonnumeric or out-of-range settings', () => {
    for (const saved of ['broken JSON', 'null', '[]', '0', '{"decimalPlaces":-1}', '{"decimalPlaces":7}', '{"decimalPlaces":2.5}', '{"decimalPlaces":"4"}', '{}']) {
      const storage = memoryStorage({ [displayPreferencesKey('app')]: saved })
      expect(readDecimalPlaces('app', storage), saved).toBe(3)
    }
    for (const invalid of [undefined, null, -3, 7, 1.5, '2', NaN, Infinity]) expect(normalizeDecimalPlaces(invalid)).toBe(3)
  })

  it('continues working when browser storage is unavailable or blocked', () => {
    const blocked: DisplayPreferenceStorage = {
      getItem: () => { throw new Error('Blocked') }, setItem: () => { throw new Error('Blocked') },
    }
    expect(readDecimalPlaces('app', blocked)).toBe(3)
    expect(writeDecimalPlaces('app', 5, blocked)).toBe(false)
    expect(() => renderToStaticMarkup(<NumberFormatProvider appId="app"><DecimalPlacesControl /></NumberFormatProvider>)).not.toThrow()
  })

  it('uses the saved setting throughout a provider and exposes the selectable display-only control', () => {
    function Value() { const { format } = useNumberFormat(); return <output>{format(0.123456789)}</output> }
    const html = renderAtPrecision(<><Value /><DecimalPlacesControl /></>, 5)
    expect(html).toContain('<output>0.12346</output>')
    expect(html).toContain('<option value="5" selected="">5</option>')
    expect(html).toContain('Maximum decimals shown; trailing zeros are omitted.')
    expect(html).toContain('Calculations and editable model values keep their full precision.')
  })
})

describe('precision is independent of the model state', () => {
  it('keeps editable physical values at full precision even with integer display', () => {
    const html = renderAtPrecision(<ParameterControl definition={oscillatorModel.controls[0]} value={2.123456789} onChange={() => {}} />, 0)
    expect(html.match(/value="2\.123456789"/g)).toHaveLength(2)
  })

  it.each([oscillatorModel, relaxationModel])('changes $id labels and lesson values without changing its geometry or sampled physics', model => {
    const parameters: NumericParameters = model.id === 'oscillator'
      ? { mass: 2.123456, spring: 18.654321, release: 0.23456789, initialVelocity: 0.01234567 }
      : { initial: 0.91234567, target: 0.23456789, rate: 0.67891234 }
    const time = 0.123456789
    const snapshot = model.sample(parameters, time)
    const before = JSON.stringify({ parameters, snapshot })
    const sceneProps = { parameters, snapshot, display: { labels: true, forces: true }, onParameterChange: () => {}, onInteractionStart: () => {}, onInteractionEnd: () => {} }
    const sceneAtZero = renderAtPrecision(createElement(model.Scene, sceneProps), 0)
    const sceneAtSix = renderAtPrecision(createElement(model.Scene, sceneProps), 6)
    const lessonAtZero = renderAtPrecision(createElement(model.Lesson, { parameters, snapshot, time }), 0)
    const lessonAtSix = renderAtPrecision(createElement(model.Lesson, { parameters, snapshot, time }), 6)
    expect(sceneAtZero).not.toBe(sceneAtSix)
    expect(lessonAtZero).toContain('t = 0 s')
    expect(lessonAtSix).toContain('t = 0.123457 s')
    const liveEquation = lessonAtSix.match(/aria-label="Live substituted [^"]*">([\s\S]*?)<\/div>/)?.[1]
    expect(liveEquation).toBeDefined()
    for (const label of model.id === 'oscillator' ? ['m', 'ẍ', 'k', 'x'] : ['dy/dt', 'r', 'y', 'y*']) {
      expect(liveEquation).toContain(`<small>${label}</small>`)
    }
    expect(liveEquation).not.toContain('katex')
    const geometry = (html: string) => html.match(/(?:\bx|\by|cx|cy|width|height|points|\bd)="[^"]*"/g)
    expect(geometry(sceneAtZero)).toEqual(geometry(sceneAtSix))
    expect(JSON.stringify({ parameters, snapshot })).toBe(before)
    expect(model.sample(parameters, time)).toEqual(snapshot)
  })
})
