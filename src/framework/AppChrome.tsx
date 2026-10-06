// Adapted from the user's zombie-fire-suppression-sim v0.20.0 cinematic shell.
// Navigation icons retain their source provenance; branding and content come from config.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { FinderPortal, useCinematicUI } from './CinematicUI'
import type { AppConfig, GuideEntry, SimulationDefinition } from './types'
import './cinematic.css'

export type AppChromeProps = {
  config: AppConfig
  models: SimulationDefinition[]
  activeId: string
  onModel: (id: string) => void
  onResetView?: () => void
}

function Pinwheel() {
  return <svg className="version-pinwheel" viewBox="0 0 72 134" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M36 38v96" /><g className="pinwheel-rotor">{[0, 90, 180, 270].map(angle => <path key={angle} transform={`rotate(${angle} 36 33)`} d="M39 29C54 29 60 21 55 12C51 5 39 1 37 8C35 14 40 20 36 26" />)}<circle cx="36" cy="33" r="3.2" /></g></svg>
}
function FinderIcon() {
  return <svg viewBox="0 0 106 106" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M4 5l35 35V4h6v45H3v-6h31L1 10zM53 4h49v24L77 51H53zM77 51V34q0-7 7-7h18" /><circle cx="29" cy="75" r="18" /><path d="M16 88L3 102l5 4 13-15" /><circle cx="79" cy="80" r="24" />{Array.from({ length: 9 }, (_, i) => { const a = i * Math.PI * 2 / 9; return <circle key={i} cx={79 + 17 * Math.cos(a)} cy={80 + 17 * Math.sin(a)} r="3.5" /> })}</svg>
}
function ToolboxIcon() {
  return <svg viewBox="0 0 185 87.1" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><path d="M26 3L55 20 40 47l31 18q15 9 7 23t-24 5L24 75 8 99-18 82 0 50l12 7 8-14-12-7z" transform="translate(22 -2) scale(.9)" /><path d="M131 8h29l21 37-21 37h-42L97 45l21-37z" /><circle cx="139" cy="45" r="18" /></svg>
}

export function AppChrome({ config, models, activeId, onModel, onResetView }: AppChromeProps) {
  const { panel, open, query, setFinderTab } = useCinematicUI()
  const [menu, setMenu] = useState(false)
  const [compact, setCompact] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const switcherRef = useRef<HTMLButtonElement>(null)
  const focusIntent = useRef<'selected' | 'first' | 'last'>('selected')
  const menuId = useId()

  useEffect(() => {
    const scroll = () => setCompact(window.scrollY > window.innerHeight * .35)
    scroll()
    window.addEventListener('scroll', scroll, { passive: true })
    window.addEventListener('resize', scroll)
    return () => { window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll) }
  }, [])

  useEffect(() => {
    if (!menu) return
    const outside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false)
    }
    const key = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenu(false)
        switcherRef.current?.focus({ preventScroll: true })
      }
    }
    const frame = requestAnimationFrame(() => {
      const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
      const selected = buttons.find(button => button.dataset.modelId === activeId)
      const target = focusIntent.current === 'last' ? buttons[buttons.length - 1]
        : focusIntent.current === 'first' ? buttons[0] : selected ?? buttons[0]
      target?.focus({ preventScroll: true })
    })
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', key)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', key)
    }
  }, [menu, activeId, models])

  const select = (id: string) => {
    onModel(id)
    setMenu(false)
    open(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
    switcherRef.current?.focus({ preventScroll: true })
  }
  const render = () => {
    setMenu(false)
    open(null)
    onResetView?.()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
  const finder = (tab: 'guides' | 'docs' = 'guides') => {
    setFinderTab(tab)
    setMenu(false)
    open('finder')
  }
  const menuKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])
    if (!buttons.length) return
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? (current + 1) % buttons.length
      : event.key === 'ArrowUp' ? (current + buttons.length - 1) % buttons.length
        : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1
    if (next < 0) return
    event.preventDefault()
    event.stopPropagation()
    buttons[next]?.focus()
  }
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const matches = (text: string) => words.every(word => text.toLowerCase().includes(word))
  const results = models.filter(item => matches(`${item.title} ${item.description} ${item.id}`))
  const guides: (GuideEntry & { key: string; modelTitle?: string })[] = [
    { key: 'general-select', title: 'Choose a model', text: `Open ${config.switcherLabel} to choose any registered model. Each model supplies its own scene, controls, readouts, and reference. Use arrow keys to move through the menu and Escape to close it.` },
    { key: 'general-playback', title: 'Play, pause, and inspect', text: 'Use Play/Pause to control time, or seek directly to an instant. Changing models, editing parameters, and opening drawers preserve your playback choice. Display speed changes viewing speed without changing the model.' },
    { key: 'general-controls', title: 'Edit a value', text: 'Toolbox contains the active model’s parameters. Use a slider or type a number; Enter or leaving the field commits it. Escape restores the previous value. Values stay within the bounds and units shown.' },
    { key: 'general-finder', title: 'Find a concept or control', text: `Search Finder for a model, a guide, or a current value. A value opens its matching control in Toolbox. Open ${config.documentationLabel} for the selected model’s formulas and reference.` },
    ...models.flatMap(model => [
      { key: `${model.id}-overview`, title: model.title, text: [model.description, model.interactionHint].filter(Boolean).join(' '), modelTitle: model.title },
      ...(model.guides ?? []).map((guide, index) => ({ ...guide, key: `${model.id}-guide-${index}`, modelTitle: model.title })),
    ]),
  ]

  return <>
    <header className={`cinematic-header ${compact ? 'is-compact' : ''}`}>
      <button type="button" className="cinematic-brand" onClick={render} aria-label={`${config.title} home`} title={config.title}>
        {config.shortTitle}<span>Ver.[{config.version}]</span>
      </button>
      <div className="version-navigation" ref={menuRef} onBlur={event => {
        if (event.relatedTarget && (event.relatedTarget === switcherRef.current || !event.currentTarget.contains(event.relatedTarget as Node))) setMenu(false)
      }}>
        <button type="button" ref={switcherRef} className="cinematic-nav-button" aria-label={config.switcherLabel}
          aria-haspopup="menu" aria-expanded={menu} aria-controls={menu ? menuId : undefined}
          onClick={() => { open(null); focusIntent.current = 'selected'; setMenu(value => !value) }}
          onKeyDown={event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
            event.preventDefault()
            focusIntent.current = event.key === 'ArrowDown' ? 'first' : 'last'
            open(null)
            if (menu) {
              const buttons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')
              const target = event.key === 'ArrowDown' ? buttons?.[0] : buttons?.[buttons.length - 1]
              target?.focus()
            } else setMenu(true)
          }}>
          <Pinwheel /><span>{config.switcherLabel}</span>
        </button>
        {menu && <div id={menuId} className="version-menu" role="menu" aria-label={`Choose a model · ${config.switcherLabel}`} onKeyDown={menuKeys}>
          <span className="drawer-section-label">CHOOSE A MODEL</span>
          {models.map((item, index) => <button type="button" key={item.id} role="menuitemradio"
            tabIndex={-1} aria-checked={activeId === item.id} aria-current={activeId === item.id ? 'page' : undefined}
            data-model-id={item.id} onClick={() => select(item.id)}>
            <small>{String(index + 1).padStart(2, '0')}</small>
            <span>{item.title}<em>{item.description}</em></span><b aria-hidden="true">↗</b>
          </button>)}
        </div>}
      </div>
      <div className="finder-navigation">
        <button type="button" className="cinematic-nav-button" aria-label="Open Finder" aria-expanded={panel === 'finder'}
          onClick={() => { setMenu(false); open(panel === 'finder' ? null : 'finder') }}>
          <FinderIcon /><span>finder</span>
        </button>
        <nav className="cinematic-sublinks" aria-label="Finder sections">
          <button type="button" onClick={() => finder()}>guides &amp; values</button>
          <button type="button" onClick={() => finder('docs')}>{config.documentationLabel}</button>
          <button type="button" onClick={() => finder()}>search</button>
        </nav>
      </div>
      <button type="button" className="toolbox-navigation" aria-label="Open Toolbox" aria-expanded={panel === 'toolbox'}
        title="Edit model parameters" onClick={() => { setMenu(false); open(panel === 'toolbox' ? null : 'toolbox') }}>
        <ToolboxIcon /><span>toolbox</span>
      </button>
    </header>
    <FinderPortal>
      <section className="finder-destinations">
        <div className="drawer-section-label">JUMP TO</div>
        {results.map(item => <button type="button" key={item.id} onClick={() => select(item.id)}>
          <span>{item.title}<small>{item.description}</small></span><b aria-hidden="true">↗</b>
        </button>)}
        {matches(`${config.documentationLabel} formula reference documentation`) && <button type="button" onClick={() => finder('docs')}>
          <span>{config.documentationLabel}<small>Model formulas, explanations, and reference</small></span><b aria-hidden="true">↗</b>
        </button>}
      </section>
      <section className="finder-handbook">
        <div className="drawer-section-label">GUIDES</div>
        {guides.filter(item => matches(`${item.title} ${item.text} ${item.modelTitle ?? ''}`)).map(item => <details key={item.key}>
          <summary>{item.title}</summary>
          {item.modelTitle && <small>{item.modelTitle}</small>}
          <p>{item.text}</p>
        </details>)}
      </section>
    </FinderPortal>
  </>
}

export default AppChrome
