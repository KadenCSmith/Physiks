import type { SimulationDefinition } from './framework/types'
import { oscillatorModel } from './examples/oscillator'
import { relaxationModel } from './examples/relaxation'

/** Add or replace examples here; the shell reads this registry. */
export const models: SimulationDefinition[] = [oscillatorModel, relaxationModel]
export { oscillatorModel, relaxationModel }
