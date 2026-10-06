// Adapted from the user's zombie-fire-suppression-sim v0.20.0 cinematic shell.
// Shared portal drawers and focus management preserve that architecture.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Search, X } from 'lucide-react'
import type { AppConfig } from './types'
import { DecimalPlacesControl, NumberFormatProvider, useNumberFormat } from './formatting'

export type CinematicPanel = 'finder' | 'toolbox' | null
type Slot = 'tools' | 'extras' | 'guides' | 'docs'
type FinderTab = 'guides' | 'docs'
type CinematicUI = {
  config: AppConfig
  panel: CinematicPanel
  open: (panel: CinematicPanel) => void
  query: string
  finderTab: FinderTab
  setFinderTab: (tab: FinderTab) => void
  slots: Record<Slot, HTMLElement | null>
}

const Context = createContext<CinematicUI | null>(null)

export function useCinematicUI() {
  const value = useContext(Context)
  if (!value) throw new Error('useCinematicUI requires a CinematicUIProvider')
  return value
}

export function ToolboxPortal({ children, extra = false }: { children: ReactNode; extra?: boolean }) {
  const { slots } = useCinematicUI()
  const node = slots[extra ? 'extras' : 'tools']
  return node ? createPortal(children, node) : null
}

export function FinderPortal({ children, documentation = false }: { children: ReactNode; documentation?: boolean }) {
  const { slots } = useCinematicUI()
  const node = slots[documentation ? 'docs' : 'guides']
  return node ? createPortal(children, node) : null
}

type Variable = {
  element: HTMLInputElement | HTMLSelectElement
  label: string
  value: string
  note: string
}

function CurrentValues({ source }: { source: HTMLElement | null }) {
  const { open, query } = useCinematicUI()
  const { format } = useNumberFormat()
  const [items, setItems] = useState<Variable[]>([])
  const focusTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!source) { setItems([]); return }
    const read = () => setItems(Array.from(source.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type=file]):not([type=range]):not([type=hidden]), select',
    )).map(element => {
      const parent = element.closest('[data-control],.parameter-control,.number-control,.parameter-row,label,.select-row')
        ?? element.parentElement
      const label = element.getAttribute('aria-label') || parent?.getAttribute('data-control-label')
        || element.labels?.[0]?.textContent || parent?.querySelector('label')?.textContent || 'Setting'
      const raw = element instanceof HTMLSelectElement
        ? element.selectedOptions[0]?.textContent ?? element.value
        : element.type === 'checkbox' ? element.checked ? 'On' : 'Off'
          : element.type === 'number' && element.value.trim() && Number.isFinite(Number(element.value)) ? format(Number(element.value)) : element.value
      const unit = element.getAttribute('data-unit') ?? parent?.querySelector('.control-unit')?.textContent ?? ''
      return {
        element,
        label: label.trim().replace(/\s+/g, ' '),
        value: `${raw}${unit.trim() ? ` ${unit.trim()}` : ''}`,
        note: parent?.querySelector('.control-note,small')?.textContent ?? element.title ?? '',
      }
    }).filter(item => item.label))
    read()
    // Controlled values can change without a native input event (model switch/reset).
    const timer = window.setInterval(read, 1000)
    const observer = new MutationObserver(read)
    observer.observe(source, { childList: true, subtree: true, attributes: true, attributeFilter: ['value', 'checked'] })
    source.addEventListener('change', read)
    source.addEventListener('input', read)
    return () => {
      clearInterval(timer)
      observer.disconnect()
      source.removeEventListener('change', read)
      source.removeEventListener('input', read)
    }
  }, [source, format])
  useEffect(() => () => clearTimeout(focusTimer.current), [])

  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const filtered = items.filter(item => words.every(word => `${item.label} ${item.note} ${item.value}`.toLowerCase().includes(word)))
  if (!filtered.length) return null

  return <section className="finder-values">
    <div className="drawer-section-label">CURRENT VALUES <span>{filtered.length}</span></div>
    <p>Select a value to open its control in Toolbox.</p>
    {filtered.map((item, index) => <button type="button" key={`${item.element.id || item.label}-${index}`} onClick={() => {
      open('toolbox')
      let parent = item.element.parentElement
      while (parent) {
        if (parent instanceof HTMLDetailsElement) parent.open = true
        parent = parent.parentElement
      }
      clearTimeout(focusTimer.current)
      focusTimer.current = window.setTimeout(() => {
        if (item.element.isConnected && !item.element.closest('[hidden],[inert]')) {
          item.element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' })
          item.element.focus({ preventScroll: true })
        }
      }, 350)
    }}>
      <span>{item.label}{item.note && <small>{item.note}</small>}</span>
      <strong>{item.value}</strong><ArrowUpRight size={14} aria-hidden="true" />
    </button>)}
  </section>
}

export function CinematicUIProvider({ children, config }: { children: ReactNode; config: AppConfig }) {
  const [panel, setPanel] = useState<CinematicPanel>(null)
  const [query, setQuery] = useState('')
  const [finderTab, setFinderTab] = useState<FinderTab>('guides')
  const [slots, setSlots] = useState<Record<Slot, HTMLElement | null>>({ tools: null, extras: null, guides: null, docs: null })
  const toolsRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, tools: node })), [])
  const extrasRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, extras: node })), [])
  const guidesRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, guides: node })), [])
  const docsRef = useCallback((node: HTMLDivElement | null) => setSlots(old => ({ ...old, docs: node })), [])
  const drawer = useRef<HTMLElement>(null)
  const appContent = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const activePanel = useRef<CinematicPanel>(null)
  const focusTimer = useRef<number | undefined>(undefined)
  const headingId = useId()

  const open = useCallback((next: CinematicPanel) => {
    const previous = activePanel.current
    clearTimeout(focusTimer.current)
    if (next && !previous) returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    activePanel.current = next
    setPanel(next)
    if (!next && previous) {
      focusTimer.current = window.setTimeout(() => {
        const target = returnFocus.current?.isConnected ? returnFocus.current : appContent.current?.querySelector<HTMLElement>('button,a[href],[tabindex="0"]')
        target?.focus({ preventScroll: true })
      }, 20)
    }
  }, [])

  useEffect(() => {
    document.body.classList.add('cinematic-ui')
    return () => { document.body.classList.remove('cinematic-ui'); clearTimeout(focusTimer.current) }
  }, [])
  useEffect(() => {
    if (!panel) return
    const stopBackgroundScroll = (event: Event) => {
      if (!drawer.current?.contains(event.target as Node)) event.preventDefault()
    }
    document.addEventListener('wheel', stopBackgroundScroll, { passive: false })
    document.addEventListener('touchmove', stopBackgroundScroll, { passive: false })
    const frame = requestAnimationFrame(() => drawer.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true }))
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); open(null); return }
      if (event.key !== 'Tab') return
      const elements = Array.from(drawer.current?.querySelectorAll<HTMLElement>(
        'button,input,select,textarea,summary,a[href],[tabindex="0"]',
      ) ?? []).filter(element => !element.closest('[hidden],[inert]') && element.getClientRects().length
        && !(element as HTMLButtonElement).disabled)
      const first = elements[0], last = elements[elements.length - 1]
      if (!first) { event.preventDefault(); drawer.current?.focus(); return }
      if (!drawer.current?.contains(document.activeElement)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('wheel', stopBackgroundScroll)
      document.removeEventListener('touchmove', stopBackgroundScroll)
      document.removeEventListener('keydown', key)
    }
  }, [panel, open])

  return <NumberFormatProvider key={config.id} appId={config.id}><Context.Provider value={{ config, panel, open, query, finderTab, setFinderTab, slots }}>
    <div ref={appContent} className="cinematic-app-content" inert={!!panel}>{children}</div>
    {panel && <button type="button" className="cinematic-backdrop" aria-label="Close side panel" tabIndex={-1} onClick={() => open(null)} />}
    <aside ref={drawer} tabIndex={-1} className={`cinematic-drawer ${panel ? 'is-open' : ''}`}
      role="dialog" aria-modal={panel ? true : undefined} aria-labelledby={headingId}
      aria-hidden={!panel} inert={!panel} data-panel={panel ?? 'closed'}>
      <header className="drawer-heading">
        <div><span>{config.shortTitle}</span><h2 id={headingId}>{panel === 'finder' ? 'finder' : 'toolbox'}</h2></div>
        <button type="button" aria-label="Close side panel" onClick={() => open(null)}><X size={25} strokeWidth={1} /></button>
      </header>
      <div className="drawer-content" hidden={panel !== 'finder'}>
        <label className="finder-search"><Search size={18} strokeWidth={1} aria-hidden="true" />
          <input type="search" aria-label="Search Finder" placeholder={finderTab === 'docs' ? 'Search formulas and reference' : 'Search guides, models, and values'}
            value={query} onChange={event => setQuery(event.target.value)} />
        </label>
        <div className="finder-tabs">
          <button type="button" aria-pressed={finderTab === 'guides'} onClick={() => setFinderTab('guides')}>guides &amp; values</button>
          <button type="button" aria-pressed={finderTab === 'docs'} onClick={() => setFinderTab('docs')}>{config.documentationLabel}</button>
        </div>
        <div hidden={finderTab !== 'guides'}><div ref={guidesRef} /><CurrentValues source={slots.tools} /></div>
        <div hidden={finderTab !== 'docs'} ref={docsRef} />
      </div>
      <div className="drawer-content" hidden={panel !== 'toolbox'}>
        <div className="drawer-section-label">MODEL CONTROLS</div>
        <p className="drawer-intro">Adjust the current model. Each value uses the units shown beside its control.</p>
        <div ref={toolsRef} />
        <div className="drawer-section-label drawer-extras-heading">MORE TOOLS</div>
        <DecimalPlacesControl />
        <div ref={extrasRef} />
      </div>
    </aside>
  </Context.Provider></NumberFormatProvider>
}
