import { deepEqual } from 'fast-equals'
import selectUtils from '../utils/select'
import matchAll from 'match-all'
import debounce from 'debounce-promise'
import { h, resolveComponent } from 'vue'

export default {
  data() {
    return {
      rawSelectItems: null,
      selectItems: [],
      q: '',
      fromUrlParams: {}
    }
  },
  computed: {
    isSelectProp() {
      if (!this.fullSchema) return
      if (this.display === 'list') return false
      if (this.fullSchema.enum) return true
      if (this.fullSchema.type === 'array' && this.fullSchema.items && this.fullSchema.items.enum) return true
      if (this.oneOfSelect) return true
      if (this.examplesSelect) return true
      // WARNING: it is important not to use this.fromUrl here
      // because it is empty at first when fromUrlParams are not ready yet and it creates initialization problems
      if (this.fullSchema['x-fromUrl']) return true
      if (this.fromData) return true
      return false
    },
    oneOfSelect() {
      return selectUtils.isOneOfSelect(this.fullSchema)
    },
    examplesSelect() {
      if (!this.fullSchema) return
      if (this.fullSchema.type === 'array' && this.fullSchema.items && ['string', 'integer', 'number'].includes(this.fullSchema.items.type) && this.fullSchema.items.examples) return true
      if (['string', 'integer', 'number'].includes(this.fullSchema.type) && this.fullSchema.examples) return true
      return false
    },
    fromUrlWithQuery() {
      if (!this.fullSchema) return
      return !!(this.fullSchema['x-fromUrl'] && this.fullSchema['x-fromUrl'].indexOf('{q}') !== -1)
    },
    fromUrlKeys() {
      if (!this.fullSchema) return
      // Look for variable parts in the URL used to fetch data
      if (!this.fullSchema['x-fromUrl']) return null
      return matchAll(this.fullSchema['x-fromUrl'], /\{(.*?)\}/g).toArray().filter(key => key !== 'q')
    },
    fromUrl() {
      if (!this.fullSchema) return
      let url = this.fullSchema['x-fromUrl']
      if (!url) return
      for (const key of this.fromUrlKeys) {
        // URL parameters are incomplete
        if (this.fromUrlParams[key] === undefined) return
        else url = url.replace(`{${key}}`, this.fromUrlParams[key])
      }
      return url
    },
    fromData() {
      if (!this.fullSchema) return
      return this.fullSchema['x-fromData']
    },
    itemKey() {
      if (!this.fullSchema) return
      return this.fullSchema['x-itemKey'] || 'key'
    },
    itemTitle() {
      if (!this.fullSchema) return
      return this.fullSchema['x-itemTitle'] || 'title'
    },
    itemIcon() {
      if (!this.fullSchema) return
      return this.fullSchema['x-itemIcon'] || (this.display === 'icon' ? 'icon' : null)
    },
    returnObject() {
      if (!this.fullSchema) return
      return this.fullSchema.type === 'object' || (this.fullSchema.items && this.fullSchema.items.type === 'object')
    }
  },
  watch: {
    q() {
      // This line prevents reloading the list just after selecting an item in an auto-complete
      if (this.modelValue && this.modelValue[this.itemTitle] === this.q) return
      this.fetchSelectItems()
    },
    rawSelectItems: {
      handler() {
        this.updateSelectItems()
      }
    }
  },
  methods: {
    initSelectProp(model) {
      // Case of an auto-complete field already defined
      if (this.fromUrlWithQuery && model && model[this.itemTitle] !== undefined) {
        this.q = model[this.itemTitle]
      }
      // Case of a select based on ajax query
      if (this.fromUrl) {
        this.fetchSelectItems()
      }
      if (this.fullSchema['x-fromUrl']) {
        // do not use this.fromUrl to determine this.openEndedSelect as it might be null if missing parameters
        this.openEndedSelect = this.customTag === 'v-combobox' || this.fullSchema['x-display'] === 'combobox'
      }
      // Case of select based on an enum
      if ((this.fullSchema.type === 'array' && this.fullSchema.items && this.fullSchema.items.enum) || this.fullSchema.enum) {
        this.rawSelectItems = this.fullSchema.type === 'array' ? this.fullSchema.items.enum : this.fullSchema.enum
      }
      // Case of select based on a oneof on simple types
      if (this.oneOfSelect) {
        const schema = (this.fullSchema.type === 'array' ? this.fullSchema.items : this.fullSchema)
        const of = schema.anyOf || schema.oneOf
        this.openEndedSelect = schema.anyOf && !!schema.anyOf.find(item => !item.const && !item.enum)
        this.rawSelectItems = of
          .filter(item => !item['x-if'] || !!this.getFromExpr(item['x-if']))
          .filter(
            item => ('const' in item) || !!item.enum
          )
          .map(item => {
            const _itemValue = ('const' in item) ? item.const : (item.enum && item.enum[0])
            return { ...item, [this.itemKey]: _itemValue }
          })
      }

      // Case of combobox based on examples
      if (this.examplesSelect) {
        const examples = (this.fullSchema.type === 'array' ? (this.fullSchema.items.examples || this.fullSchema.examples) : this.fullSchema.examples)
        this.openEndedSelect = true
        this.rawSelectItems = examples.map(example => ({ [this.itemKey]: example, [this.itemTitle]: example }))
      }

      // Case of a select based on an array somewhere in the data
      if (this.fullSchema['x-fromData']) {
        this.openEndedSelect = this.customTag === 'v-combobox' || this.fullSchema['x-display'] === 'combobox'
        this.$watch(() => this.getFromExpr(this.fullSchema['x-fromData']), (val) => {
          this.rawSelectItems = val
        }, { immediate: true })
      }
      // Watch the dynamic parts of the URL used to fill the select field
      if (this.fromUrlKeys) {
        this.fromUrlKeys.forEach(key => {
          this.$watch(() => this.getFromExpr(key), (val) => {
            this.fromUrlParams[key] = val
            this.fetchSelectItems()
          }, { immediate: true })
        })
      }
    },
    fetchSelectItems() {
      if (!this.fromUrl) return
      if (!this.fullOptions.httpLib) {
        console.error('No http lib found to perform ajax request')
        return this.$emit('error', 'No http lib found to perform ajax request')
      }
      this.debouncedFetch = this.debouncedFetch || debounce(async () => {
        this.loading = true
        try {
          this.rawSelectItems = await selectUtils.fetchRawItems(this.fullOptions, this.fullSchema, this.fromUrl, this.q)
        } catch (err) {
          console.error(err)
          this.$emit('error', err.message)
        }
        this.loading = false
      }, 250)
      const promise = this.debouncedFetch()
      // store all current promises in sharedData.asyncOperations so that we can delay change events
      // until after a user interaction has finished having async consequencies
      this.sharedData.asyncOperations = this.sharedData.asyncOperations || {}
      this.sharedData.asyncOperations[this.fullKey] = promise
      promise.finally(() => {
        if (this.sharedData.asyncOperations[this.fullKey] === promise) delete this.sharedData.asyncOperations[this.fullKey]
      })
    },
    async updateSelectItems() {
      const selectItems = selectUtils.getSelectItems(this.rawSelectItems, this.fullSchema, this.itemKey, this.itemTitle, this.itemIcon)
      if (this.display === 'list' && this.rawSelectItems) {
        this.input(selectUtils.fillList(this.fullSchema, this.modelValue, selectItems, this.itemKey))
      }

      this.loading = true
      await selectUtils.fillSelectItems(
        this.fullOptions,
        this.fullSchema,
        this.separator && typeof this.modelValue === 'string' ? this.modelValue.split(this.separator) : this.modelValue,
        selectItems,
        this.itemKey,
        this.itemTitle,
        this.fromUrlWithQuery && this.fromUrl,
        this.returnObject
      )
      this.loading = false

      // we check for actual differences in order to prevent infinite loops
      if (!deepEqual(selectItems, this.selectItems)) {
        this.selectItems = selectItems
      }
    },
    renderSelectIcon(item) {
      const iconListItem = {

      }
      if (!this.itemIcon) return iconListItem
      let itemIcon = item[this.itemIcon]
      if (!itemIcon) return iconListItem

      if (itemIcon.startsWith('http://') || itemIcon.startsWith('https://')) {
        iconListItem.href = itemIcon
        iconListItem.width = '100%'
        iconListItem.height = '100%'
        /* } else if (itemIcon.startsWith('<?xml') || itemIcon.startsWith('<svg')) {
        iconChild = h('div', { innerHTML: itemIcon })
       */
      } else {
        const prefix = this.fullOptions.iconfont + '-'
        if (this.fullOptions.iconfont && !itemIcon.startsWith(prefix)) itemIcon = prefix + itemIcon
        iconListItem.prependIcon = itemIcon
      }
      return iconListItem
      // return h(resolveComponent('v-avatar'), { rounded: 0, size: 20, class: 'mr-2' }, { default: () => iconChild })
    },
    renderSelectCheckbox(value) {
      if (this.fullSchema.type !== 'array' || this.itemIcon) return
      return { prepend: () => { h(resolveComponent('v-checkbox-btn'), { modelValue: value }) } }
    },
    renderSelectionControlItem(item) {
      const label = item[this.itemTitle] || item[this.itemKey]
      const value = item[this.itemKey]
      const on = {
        'onUpdate:modelValue': (inputValue) => {
          this.input(inputValue)
          // this.change()
        }
      }
      const props = {
        ...this.fullOptions.radioItemProps,
        label,
        value,
        modelValue: Object.values(this.modelValue),
        multiple: this.fullSchema.type === 'array' || !!this.separator,
        hideDetails: true,
        density: 'compact',
        'onUpdate:modelValue': on['onUpdate:modelValue'],
        class: 'pb-1'
      }

      return h(resolveComponent(`v-${this.display}`), props)
    },
    renderSelectionControlGroup() {
      const on = {
        'onUpdate:modelValue': value => {
          this.input(value)
          // this.change()
        }
      }
      const props = {
        ...this.commonFieldProps,
        multiple: this.fullSchema.type === 'array' || !!this.separator,
        label: null,
        'onUpdate:modelValue': on['onUpdate:modelValue'],
        class: 'v-radio-group'
      }
      // imitate a radio-group, but with checkboxes and switches
      const legend = h('label', { class: `v-label theme--${this.theme.isDark ? 'dark' : 'light'} ${this.hasError ? 'error--text' : ''}` }, this.commonFieldProps.label)
      console.log(this.selectItems.map(item => this.renderSelectionControlItem(item)))
      const itemsElements = this.selectItems.map(item => this.renderSelectionControlItem(item))
      return [
        h(resolveComponent('v-input'), props, {
          default: () => [legend, h('div', { class: 'v-selection-control-group' }, ...itemsElements)],
          append: () => this.renderTooltip()
        })

      ]
    },
    renderRadioItem(item) {
      const label = item[this.itemTitle] || item[this.itemKey]
      const value = item[this.itemKey]
      const props = {
        ...this.fullOptions.radioItemProps, label, value
      }
      return h(resolveComponent('v-radio'), props)
    },
    renderRadioGroup() {
      const on = {
        'onUpdate:modelValue': value => {
          this.input(value)
          // this.change()
        }
      }
      const props = {
        ...this.commonFieldProps,
        ...this.fullOptions.radioGroupProps,
        'onUpdate:modelValue': on['onUpdate:modelValue']
      }
      console.log('v-radio!!!', [...this.selectItems.map(item => this.renderRadioItem(item))])
      delete props.value
      return [h(resolveComponent('v-radio-group'), props, {
        default: () => [...this.selectItems.map(item => this.renderRadioItem(item))],
        append: () => this.renderTooltip()
      })]
    },
    renderSelectProp() {
      if (!this.isSelectProp) return

      // radio cannot be applied on an array
      if (this.display === 'radio') {
        if (this.fullSchema.type === 'array' || this.separator) {
          console.error('radio display is not available for arrays, use checkbox or switch')
        } else {
          return this.renderRadioGroup()
        }
      }

      if (['checkbox', 'switch'].includes(this.display)) {
        return this.renderSelectionControlGroup()
      }

      const on = {
        'onUpdate:modelValue': value => {
          this.input(value)
          // this.change()
        }
      }

      const slots = {
        item: ({ props, item }) => {
          const itemIcon = item.raw[this.itemIcon]
          const _slots = {}
          if (itemIcon) {
            if (itemIcon.startsWith('<?xml') || itemIcon.startsWith('<svg')) {
              _slots.prepend = () => h('div', { innerHTML: itemIcon })
            } else if (itemIcon.startsWith('http://') || itemIcon.startsWith('https://')) {
              _slots.prepend = () => h('img', { src: itemIcon, style: 'height:100%;width:100%;' })
            } else {
              props.prependIcon = itemIcon
            }
          } else if (this.fullSchema.type === 'array') {
            _slots.prepend = ({ isActive }) => h(resolveComponent('v-checkbox-btn'), { modelValue: isActive })
          }
          return h(resolveComponent('v-list-item'), props, _slots)
        },
        selection: ({ item, index }) => {
          const itemIcon = item.raw[this.itemIcon]
          const value = this.modelValue
          let text = item.title
          if (this.fullSchema.type === 'array' && index !== value.length - 1) text += ',&nbsp;'
          if (this.separator && this.commonFieldProps.value && index !== this.commonFieldProps.value.length - 1) text += ',&nbsp;'
          const _slots = []
          if (itemIcon) {
            if (itemIcon.startsWith('<?xml') || itemIcon.startsWith('<svg')) {
              _slots.push(h('div', { innerHTML: itemIcon }))
            } else if (itemIcon.startsWith('http://') || itemIcon.startsWith('https://')) {
              _slots.push(h(resolveComponent('v-avatar'), { tile: true, size: 20 }, () => h('img', { src: itemIcon, style: 'height:100%;width:100%;' })))
            } else {
              _slots.push(h(resolveComponent('v-icon'), { icon: itemIcon }))
            }
          }

          _slots.push(h('span', { innerHTML: text, class: 'mt-1' }))
          return h('span',
            { class: { 'v-select__selection': true, 'v-select__selection--comma': true, 'v-select__selection--disabled': this.disabled } },
            _slots
          )
        }
      }

      // Este código comentado ya estaba comentado en el código antiguo
      // checkbox can only be applied on an array
      /* if (this.display === 'checkbox' && this.fullSchema.type === 'array') {
        return [h('v-col', { props, slots }, [
          ...this.selectItems.map(item => this.renderCheckboxItem(item, on))
        ])]
      } */
      let tag = 'v-select'
      if (this.customTag) tag = this.customTag
      else if (this.display) {
        if (this.display === 'autocomplete') tag = 'v-autocomplete'
        if (this.display === 'select') tag = 'v-select'
      } else {
        if (this.fromUrlWithQuery || (this.rawSelectItems && this.rawSelectItems.length > 20)) tag = 'v-autocomplete'
      }

      const props = {
        ...this.commonFieldProps,
        ...this.fullOptions.selectProps,
        'validate-on': 'blur', // without this we sometimes get a weird infinite render loop
        clearable: !this.required,
        // TODO: modelValue: this.fullSchema.type === 'array' || !!this.separator ? [] : null,
        multiple: this.fullSchema.type === 'array' || !!this.separator,
        'item-value': this.itemKey,
        'item-title': this.itemTitle,
        items: this.selectItems || [],
        'return-object': !!this.returnObject,
        loading: this.loading
      }
      if (tag === 'v-autocomplete') {
        tag = 'v-autocomplete'
        props['no-data-text'] = this.fullOptions.messages.noData
        props.placeholder = this.fullOptions.messages.search
        if (this.fromUrlWithQuery) {
          props['custom-filter'] = () => true
          props.search = this.q
          on['update:search-input'] = (searchUpdate) => { this.q = searchUpdate }
        } else {
          props['custom-filter'] = (value, q, item) => (item.raw[this.itemTitle] || item.raw[this.itemKey]).toLowerCase().indexOf(q.toLowerCase()) > -1
        }
      }

      if (this.openEndedSelect) {
        tag = 'v-combobox'
        if (!props.multiple) {
          props.hideSelected = true
          on['onUpdate:modelValue'] = value => {
            if ((this.fullSchema.type === 'number' || this.fullSchema.type === 'integer')) {
              this.input(value || null)
            } else {
              this.input(value || '')
            }
          }
        }
      }
      const children = { ...this.renderPropSlots() }

      /*  TODO: modifica el modelValue pero no se ve reflejado en el componente
      if (tag === 'v-select' && props.multiple && this.fullOptions.selectAll) {
        const allIsSelected = props.items.length === (this.modelValue.value ? this.modelValue.value.length : 0)
        children['prepend-item'] = () => [
          h(resolveComponent('v-list-item'),
            { title: this.fullOptions.messages.selectAll,
              onClick: () => {
                if (allIsSelected) {
                  this.modelValue.value = []
                } else {
                  this.modelValue.value = props.items.map(item => this.returnObject ? item : item[this.itemKey])
                }
                this.change()
              }
            }, { prepend: () =>
              h(resolveComponent('v-checkbox-btn'), { modelValue: allIsSelected })
            }),
          h(resolveComponent('v-divider'), { class: 'mt-2' })
        ]
      } */

      if (this.htmlDescription) {
        children['append-icon'] = () => this.renderTooltip()
      }
      delete props.value
      const finalProps = {
        ...props,
        ...on
      }

      Object.keys(slots).forEach(slot => {
        children[slot] = slots[slot]
      })

      return [h(resolveComponent(tag), finalProps, children)]
    }
  }
}
