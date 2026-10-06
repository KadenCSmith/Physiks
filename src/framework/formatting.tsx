import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const DEFAULT_DECIMAL_PLACES = 3
export const MAX_DECIMAL_PLACES = 6
export type DisplayPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** A display preference only: never pass formatted values back into a model. */
export function normalizeDecimalPlaces(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_DECIMAL_PLACES
    ? value : DEFAULT_DECIMAL_PLACES
}

const formatters = new Map<number, Intl.NumberFormat>()

/** At most the selected decimal places, without padding or displayed negative zero. */
export function formatNumber(value: number, decimalPlaces = DEFAULT_DECIMAL_PLACES): string {
  if (!Number.isFinite(value)) return '—'
  const places = normalizeDecimalPlaces(decimalPlaces)
  let formatter = formatters.get(places)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0, maximumFractionDigits: places, useGrouping: false,
    })
    formatters.set(places, formatter)
  }
  return formatter.format(value).replace(/^-0(?:\.0+)?$/, match => match.slice(1))
}

export function displayPreferencesKey(appId: string): string {
  return `${appId}:display:v1`
}

function availableStorage(): DisplayPreferenceStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.localStorage }
  catch { return undefined }
}

export function readDecimalPlaces(appId: string, storage = availableStorage()): number {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(displayPreferencesKey(appId)) ?? 'null')
    return normalizeDecimalPlaces(saved && typeof saved === 'object' && !Array.isArray(saved)
      ? (saved as Record<string, unknown>).decimalPlaces : undefined)
  } catch { return DEFAULT_DECIMAL_PLACES }
}

export function writeDecimalPlaces(appId: string, value: unknown, storage = availableStorage()): boolean {
  if (!storage) return false
  try {
    storage.setItem(displayPreferencesKey(appId), JSON.stringify({ decimalPlaces: normalizeDecimalPlaces(value) }))
    return true
  } catch { return false }
}

type NumberFormatContextValue = {
  decimalPlaces: number
  setDecimalPlaces: (places: number) => void
  format: (value: number) => string
}

const Context = createContext<NumberFormatContextValue>({
  decimalPlaces: DEFAULT_DECIMAL_PLACES, setDecimalPlaces: () => {}, format: formatNumber,
})

export function NumberFormatProvider({ children, appId, storage }: {
  children: ReactNode; appId: string; storage?: DisplayPreferenceStorage
}) {
  const [decimalPlaces, setPlaces] = useState(() => readDecimalPlaces(appId, storage))
  const setDecimalPlaces = useCallback((places: number) => setPlaces(normalizeDecimalPlaces(places)), [])
  const format = useCallback((value: number) => formatNumber(value, decimalPlaces), [decimalPlaces])
  useEffect(() => { writeDecimalPlaces(appId, decimalPlaces, storage) }, [appId, decimalPlaces, storage])
  const value = useMemo(() => ({ decimalPlaces, setDecimalPlaces, format }), [decimalPlaces, setDecimalPlaces, format])
  return <Context.Provider value={value}>{children}</Context.Provider>
}

/** Scene, lesson, chart and shell values share this per-app display preference. */
export function useNumberFormat(): NumberFormatContextValue {
  return useContext(Context)
}

export function DecimalPlacesControl() {
  const { decimalPlaces, setDecimalPlaces } = useNumberFormat()
  return <label className="decimal-places-control" data-control data-control-label="Decimal places">
    <span>Decimal places</span>
    <select aria-label="Decimal places" value={decimalPlaces} onChange={event => setDecimalPlaces(Number(event.target.value))}>
      {Array.from({ length: MAX_DECIMAL_PLACES + 1 }, (_, places) => <option key={places} value={places}>{places}</option>)}
    </select>
    <small className="control-note">Maximum decimals shown; trailing zeros are omitted. Calculations and editable model values keep their full precision.</small>
  </label>
}
