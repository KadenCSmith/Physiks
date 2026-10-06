import { useEffect, useMemo, useState } from 'react'
import type { SimulationDefinition } from './types'
import { MathFormula } from './Math'

export function FormulaLibrary({ models, activeId, query, onModel }: {
  models: SimulationDefinition[]; activeId: string; query: string; onModel: (id: string) => void
}) {
  const [scope, setScope] = useState(activeId)
  useEffect(() => setScope(activeId), [activeId])
  const catalog = useMemo(() => models.flatMap(model => model.formulas.map(entry => ({ ...entry, model }))), [models])
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const matches = catalog.filter(entry => (words.length > 0 || entry.model.id === scope) && words.every(word =>
    [entry.model.title, entry.title, entry.group, entry.description, entry.usage ?? '', ...entry.tex, ...(entry.sources ?? [])].join(' ').toLowerCase().includes(word)))
  const groups = new Map<string, { model: SimulationDefinition; group: string; entries: typeof matches }>()
  for (const entry of matches) {
    const key = JSON.stringify([entry.model.id, entry.group])
    const existing = groups.get(key)
    if (existing) existing.entries.push(entry)
    else groups.set(key, { model: entry.model, group: entry.group, entries: [entry] })
  }
  return <section className="formula-library" aria-label="Formula library">
    <div className="documentation-intro"><span className="eyebrow">FORMULA LIBRARY / {catalog.reduce((count, entry) => count + entry.tex.length, 0)} EQUATIONS</span><h3>Follow every step.</h3><p>Choose a model to explore its equations, underlying steps, and interpretation. Search across all models to find a concept.</p></div>
    <nav className="formula-scopes" aria-label="Formula groups">{models.map(model => <button key={model.id} aria-pressed={scope === model.id && words.length === 0} onClick={() => setScope(model.id)}>{model.title}<small>{model.formulas.length} topics</small></button>)}</nav>
    {words.length > 0 ? <p className="formula-search-summary">{matches.length} matching topics for “{query}”.</p> : <div className="formula-context"><span>{models.find(model => model.id === scope)?.description}</span>{scope !== activeId && <button onClick={() => onModel(scope)}>Open this simulation ↗</button>}</div>}
    {matches.length === 0 && <p className="formula-no-results">No matching formulas. Try a variable, a model name, or a concept.</p>}
    {Array.from(groups, ([groupKey, { model, group, entries }]) => {
      return <section className="formula-section" key={groupKey}><header><span className="eyebrow">{model.title}</span><h4>{group}</h4><small>{entries.length} topics</small></header>{entries.map(entry => <details className="formula-entry" key={`${entry.model.id}-${entry.id}-${query}`} open={words.length > 0 ? true : undefined}>
        <summary>{entry.title}</summary><div className="formula-entry-body"><p>{entry.description}</p>{entry.tex.map((tex, index) => <MathFormula key={index} tex={tex} />)}{entry.usage && <p className="formula-use"><span>Where it fits</span>{entry.usage}</p>}{entry.sources?.length ? <details className="formula-provenance"><summary>Source references</summary><p>{entry.sources.join(' · ')}</p></details> : null}</div>
      </details>)}</section>
    })}
  </section>
}
