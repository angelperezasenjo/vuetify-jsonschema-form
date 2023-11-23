import singleProperties from './single-properties'
import dynamicContent from './dynamic-content'
import sections from './sections'
import arrays from './arrays'
import validation from './validation'
import miscJsonSchema from './misc-json-schema'
import advanced from './advanced'
import dev from './dev'

const examples = [
  singleProperties,
  sections,
  arrays,
  dynamicContent,
  validation,
  miscJsonSchema,
  advanced,
  dev
]

const defaultTemplate = '<v-jsf v-model="param.model" :schema="param.schema" :options="param.options" @input="param.logEvent(\'input\', $event)" @change="logEvent(\'change\', $event)" @input-child="param.logEvent(\'input-child\', $event)" @change-child="param.logEvent(\'change-child\', $event)" />'

export { examples, defaultTemplate }
