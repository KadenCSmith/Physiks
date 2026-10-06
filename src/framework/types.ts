import type { ComponentType } from 'react'

export type NumericParameters = Record<string, number>
export type NumericSnapshot = Record<string, number>
export type ValueTone = 'position' | 'velocity' | 'force' | 'neutral'

export interface ParameterDefinition {
  key: string
  label: string
  symbol?: string
  unit?: string
  min: number
  max: number
  step: number
  note?: string
}
export interface FormulaEntry {
  id: string
  group: string
  title: string
  description: string
  tex: string[]
  usage?: string
  sources?: string[]
}
export interface GuideEntry { title: string; text: string }
export interface Readout { label: string; value: number; unit?: string; tone?: ValueTone }
export interface PlotDefinition { key: string; label: string; unit?: string; tone?: ValueTone }
export interface DisplayOptions { labels: boolean; forces: boolean }
export interface PlaybackDefinition {
  duration: number
  loop: boolean
  disabled?: boolean
  note?: string
}
export interface SimulationSceneProps {
  parameters: NumericParameters
  snapshot: NumericSnapshot
  display: DisplayOptions
  onParameterChange: (key: string, value: number) => void
  onInteractionStart: () => void
  onInteractionEnd: () => void
}
export interface SimulationLessonProps {
  parameters: NumericParameters
  snapshot: NumericSnapshot
  time: number
}

/** Register a model without changing the shell. All numeric quantities use the units declared by the model. */
export interface SimulationDefinition {
  id: string
  title: string
  description: string
  eyebrow?: string
  interactionHint?: string
  defaults: NumericParameters
  controls: ParameterDefinition[]
  sample: (parameters: NumericParameters, time: number) => NumericSnapshot
  getPlayback: (parameters: NumericParameters) => PlaybackDefinition
  getReadouts: (parameters: NumericParameters, snapshot: NumericSnapshot) => Readout[]
  Scene: ComponentType<SimulationSceneProps>
  Lesson: ComponentType<SimulationLessonProps>
  Details?: ComponentType<SimulationLessonProps>
  formulas: FormulaEntry[]
  plots?: PlotDefinition[]
  guides?: GuideEntry[]
}
export interface AppConfig {
  id: string
  title: string
  shortTitle: string
  description: string
  version: string
  switcherLabel: string
  documentationLabel: string
  defaultSpeed: number
  defaultModelId: string
}
