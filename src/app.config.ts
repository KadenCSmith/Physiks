import { version } from '../package.json'
import type { AppConfig } from './framework/types'

/** Change this file to brand a new app. Use a unique id to isolate its saved settings. */
export const appConfig: AppConfig = {
  id: 'cinematic-app-framework',
  title: 'Cinematic App Framework',
  shortTitle: 'App Studio',
  description: 'A canvas for ideas in motion.',
  version,
  switcherLabel: 'Simulation',
  documentationLabel: 'formulas & reference',
  defaultSpeed: 0.25,
  defaultModelId: 'oscillator',
}
