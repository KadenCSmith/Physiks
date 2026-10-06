import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Pause, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { appConfig } from './app.config'
import { models } from './models'
import { createSessions, resolveModelId, sanitizeParameters, validateAppConfig } from './framework/model'
import { usePlayback } from './framework/usePlayback'
import { AppChrome } from './framework/AppChrome'
import { CinematicUIProvider, FinderPortal, ToolboxPortal, useCinematicUI } from './framework/CinematicUI'
import { ParameterControl } from './framework/ParameterControl'
import { FormulaLibrary } from './framework/FormulaLibrary'
import { TimeSeriesChart } from './framework/TimeSeriesChart'

validateAppConfig(appConfig, models)
const storageKey = `${appConfig.id}:parameters:v1`
function readSessions() {
  try { return createSessions(models, JSON.parse(localStorage.getItem(storageKey) ?? 'null')) }
  catch { return createSessions(models, null) }
}
const format = (value: number) => Number.isFinite(value) ? Math.abs(value) < 1e-10 ? '0.000' : value.toFixed(3) : '—'

function Workspace() {
  const ui = useCinematicUI()
  const [activeId, setActiveId] = useState(() => resolveModelId(models, new URLSearchParams(location.search).get('model'), appConfig.defaultModelId))
  const [sessions, setSessions] = useState(readSessions)
  const [display, setDisplay] = useState({ labels: true, forces: true })
  const [interacting, setInteracting] = useState(false)
  const model = models.find(item => item.id === activeId)!
  const parameters = sessions[activeId]
  const playback = useMemo(() => model.getPlayback(parameters), [model, parameters])
  const clock = usePlayback(playback.duration, { loop: playback.loop, temporarilyPaused: interacting, disabled: playback.disabled, defaultSpeed: appConfig.defaultSpeed })
  const snapshot = useMemo(() => model.sample(parameters, clock.time), [model, parameters, clock.time])
  const readouts = model.getReadouts(parameters, snapshot)
  useEffect(() => { try { localStorage.setItem(storageKey, JSON.stringify(sessions)) } catch { /* The app also works without storage. */ } }, [sessions])
  useEffect(() => {
    document.title = appConfig.title
    document.querySelector<HTMLMetaElement>('meta[name=description]')?.setAttribute('content', appConfig.description)
  }, [])
  const selectModel = useCallback((id: string) => {
    setActiveId(resolveModelId(models, id, appConfig.defaultModelId)); setInteracting(false); clock.reset()
    const url = new URL(location.href); url.searchParams.set('model', resolveModelId(models, id, appConfig.defaultModelId)); history.replaceState(null, '', url)
  }, [clock.reset])
  const update = (key: string, value: number) => {
    if (!model.controls.some(control => control.key === key)) return
    setSessions(old => ({ ...old, [activeId]: sanitizeParameters(model, { ...old[activeId], [key]: value }) })); clock.reset()
  }
  const restore = () => { setSessions(old => ({ ...old, [activeId]: { ...model.defaults } })); clock.reset() }
  const togglePlayback = useCallback(() => {
    if (clock.ended) { clock.reset(); clock.setPlaying(true) }
    else clock.setPlaying(value => !value)
  }, [clock.ended, clock.reset, clock.setPlaying])
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (ui.panel || target.closest('input,textarea,select,button,summary,a,[role=tab],[role=slider],[contenteditable=true]')) return
      if (event.code === 'Space') { event.preventDefault(); togglePlayback() }
      if (event.key.toLowerCase() === 'r') clock.reset()
      const index = /^[1-9]$/.test(event.key) ? Number(event.key)-1 : -1
      if (models[index]) selectModel(models[index].id)
    }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [ui.panel, togglePlayback, clock.reset, selectModel])
  const { Scene, Lesson, Details } = model
  return <>
    <AppChrome config={appConfig} models={models} activeId={activeId} onModel={selectModel} onResetView={() => { setDisplay({ labels: true, forces: true }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} />
    <main className="simulation-workspace">
      <div className="workspace-heading"><div><span className="eyebrow">{model.eyebrow ?? appConfig.title} / {String(models.indexOf(model)+1).padStart(2, '0')}</span><h1>{model.title}</h1><p>{model.description}</p></div></div>
      <div className="workspace-grid">
        <div className="visual-workspace">
          <div className="scene-toolbar"><span>{model.interactionHint ?? 'Explore the current model in Toolbox'}</span><div><button aria-pressed={display.labels} onClick={() => setDisplay(old => ({ ...old, labels: !old.labels }))}>labels</button><button aria-pressed={display.forces} onClick={() => setDisplay(old => ({ ...old, forces: !old.forces }))}>forces</button></div></div>
          <Scene parameters={parameters} snapshot={snapshot} display={display} onParameterChange={update} onInteractionStart={() => setInteracting(true)} onInteractionEnd={() => setInteracting(false)} />
          <div className="live-readouts" aria-label="Live model values">{readouts.map(readout => <div key={readout.label} className={`${readout.tone ?? 'neutral'}-readout`}><span>{readout.label}</span><output>{format(readout.value)}<small>{readout.unit ? ` ${readout.unit}` : ''}</small></output></div>)}</div>
          {Details && <Details parameters={parameters} snapshot={snapshot} time={clock.time} />}
          {playback.note && <p className="model-playback-note">{playback.note}</p>}
          <TimeSeriesChart key={model.id} model={model} parameters={parameters} snapshot={snapshot} time={clock.time} duration={playback.duration} onSeek={clock.seek} />
        </div>
        <Lesson parameters={parameters} snapshot={snapshot} time={clock.time} />
      </div>
      <footer className="workspace-footer">{appConfig.description} · default viewing speed {appConfig.defaultSpeed}× · model equations use physical time</footer>
    </main>
    <ToolboxPortal><section><p className="control-context">{model.title}</p><p>Changing a value restarts the model from its initial condition.</p>{model.controls.map(control => <ParameterControl key={`${model.id}-${control.key}`} definition={control} value={parameters[control.key]} onChange={value => update(control.key, value)} />)}<div className="toolbox-actions"><button onClick={restore}>Restore example values</button></div></section></ToolboxPortal>
    <ToolboxPortal extra><div className="toolbox-actions"><button aria-pressed={display.labels} onClick={() => setDisplay(old => ({ ...old, labels: !old.labels }))}>Diagram labels</button><button aria-pressed={display.forces} onClick={() => setDisplay(old => ({ ...old, forces: !old.forces }))}>Force overlays</button></div><p>Viewing speed and overlays are separate from the model’s values.</p></ToolboxPortal>
    <FinderPortal documentation><FormulaLibrary models={models} activeId={activeId} query={ui.query} onModel={id => { selectModel(id); ui.open(null) }} /></FinderPortal>
    <div className="cinematic-transport" aria-label="Simulation playback">
      <button aria-label={clock.ended ? 'Replay simulation' : clock.playing ? 'Pause simulation' : 'Play simulation'} disabled={playback.disabled} onClick={togglePlayback}>{clock.ended ? <RotateCcw size={21} strokeWidth={1.2} /> : clock.playing ? <Pause size={21} strokeWidth={1.2} /> : <Play size={21} strokeWidth={1.2} />}</button>
      <div className="cinematic-timeline"><div><span>{clock.ended ? 'Observation complete · replay or seek backward' : model.title}</span><strong><output>{clock.time.toFixed(2)}</output> <small>/ {playback.duration.toFixed(2)} s · {playback.loop ? 'repeating' : 'observation window'}</small></strong></div><input type="range" aria-label="Simulation time" min="0" max={playback.duration} step={playback.duration/1000} value={clock.time} disabled={playback.disabled} onChange={event => clock.seek(Number(event.target.value))} /></div>
      <label className="speed-control">speed<select aria-label="Playback speed" value={clock.speed} onChange={event => clock.setSpeed(Number(event.target.value))}>{Array.from(new Set([.1, .25, .5, 1, 1.5, 2, appConfig.defaultSpeed])).sort((a,b) => a-b).map(value => <option key={value} value={value}>{value}×</option>)}</select></label>
      <button aria-label="Restart simulation" onClick={clock.reset}><RotateCcw size={18} strokeWidth={1.2} /></button><button aria-label="Open physical values" onClick={() => ui.open('toolbox')}><SlidersHorizontal size={20} strokeWidth={1.2} /></button>
    </div>
  </>
}
export default function App() { return <CinematicUIProvider config={appConfig}><Workspace /></CinematicUIProvider> }
