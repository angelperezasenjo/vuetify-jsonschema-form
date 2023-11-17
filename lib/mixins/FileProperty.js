import { h, resolveComponent } from 'vue'

const getFileDataUrl = (file) => {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.readAsDataURL(file)
  })
}

const getFileResult = async (file, schema, filesAsDataUrl) => {
  let data = file
  if (schema.type === 'string' || (schema.properties && schema.properties.data && schema.properties.data.type === 'string')) {
    const dataUrl = await getFileDataUrl(file)
    data = filesAsDataUrl ? dataUrl : dataUrl.split(';base64,')[1]
  }
  if (schema.type === 'string') return data
  return {
    name: file.name,
    lastModified: new Date(file.lastModified).toISOString(),
    size: file.size,
    type: file.type,
    data
  }
}

export default {
  computed: {
    isFileProp() {
      if (!this.fullSchema) return
      if (this.fullSchema.type === 'string' &&
        (this.fullSchema.contentMediaType || this.display === 'file')) return true
      if (this.fullSchema.type === 'array' && this.fullSchema.items && this.fullSchema.items.type === 'string' &&
        (this.fullSchema.items.contentMediaType || this.display === 'file' || this.fullSchema.items['x-display'] === 'file')) return true
      if (this.fullSchema.type === 'object' &&
        (this.fullSchema.contentMediaType || this.display === 'file')) return true
      if (this.fullSchema.type === 'array' && this.fullSchema.items && this.fullSchema.items.type === 'object' &&
        (this.fullSchema.items.contentMediaType || this.display === 'file' || this.fullSchema.items['x-display'] === 'file')) return true
      return false
    }
  },
  watch: {
    isFileProp() {
      if (this.isFileProp && !this.fullSchema.writeOnly) {
        console.warn('File property should always be used with writeOnly attribute. Files are uploaded but not read in existing data.')
      }
    }
  },
  methods: {
    renderFileProp() {
      if (!this.isFileProp) return
      const props = { ...this.commonFieldProps, ...this.fullOptions.fileInputProps }
      delete props.modelValue
      if (this.modelValue && this.modelValue.name) {
        console.log(props.placeholder)
        props.placeholder = this.modelValue.name
        props.persistentPlaceholder = true
      }
      const attrs = {}
      if (this.fullSchema.contentMediaType) attrs.accept = this.fullSchema.contentMediaType
      if (this.fullSchema.items && this.fullSchema.items.contentMediaType) attrs.accept = this.fullSchema.items.contentMediaType
      if (this.fullSchema.type === 'array') attrs.multiple = true
      const children = [...this.renderPropSlots()]
      const on = {
        'update:modelValue': async files => {
          const props = this.fullSchema.type === 'array' ? this.fullSchema.items : this.resolvedSchema
          let contents = await Promise.all(files.map(file => getFileResult(file, props, this.fullOptions.filesAsDataUrl)))
          if (attrs.multiple && Object.values(this.modelValue).length > 0) {
            contents = [...Object.values(this.modelValue), ...contents]
          }
          this.input(contents)
          // this.change()
        }
      }
      if (this.htmlDescription) {
        children.push(() => this.renderTooltip('append-outer'))
      }
      props['onUpdate:modelValue'] = on['update:modelValue']
      console.log(props)
      const _props = { ...props, ...attrs }
      return [h(resolveComponent('v-file-input'), _props, () => children)]
    }
  }
}
