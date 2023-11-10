import copy from 'fast-copy'
import { h, resolveComponent } from 'vue'
export default {
  data() {
    return {
      currentOneOf: null,
      currentTab: null,
      showCurrentOneOf: true,
      subModels: {}, // a container for objects from root subSchemass and allOfs
      currentStep: 1,
      steps: []
    }
  },
  computed: {
    isObjectContainer() {
      if (!this.fullSchema) return
      if (this.fullSchema.type !== 'object' && !Array.isArray(this.fullSchema.items)) return false
      if (this.isSelectProp) return false
      if (this.isFileProp) return false
      return true
    },
    subSchemas() {
      if (!this.fullSchema) return
      return this.fullSchema.oneOf || this.fullSchema.anyOf
    },
    subSchemasConstProp() {
      if (!this.subSchemas) return
      const props = this.subSchemas[0].properties
      const key = Object.keys(props).find(p => !!props[p].const)
      if (!key) return
      return { ...props[key], key, htmlDescription: this.fullOptions.memMarkdown(props[key].description) }
    },
    subSchemasRequired() {
      if (!this.subSchemas || !this.subSchemasConstProp) return false
      if (this.fullSchema.oneOf) return true
      if (this.fullSchema.anyOf && this.fullSchema.required && this.fullSchema.required.find(r => r === this.oneOfConstProp.key)) return true
    },
    subSchemasRules() {
      if (!this.fullSchema) return
      const rules = []
      if (this.subSchemasRequired) rules.push((val) => (val !== undefined && val !== null && val !== '') || this.fullOptions.messages.required)
      return rules
    }
  },
  watch: {
    currentOneOf(newVal, oldVal) {
      // use this boolean to force removing then re-creating the object property
      // based on the currentOneOf sub schema. If we don't the component is reused and reactivity creates some difficult bugs.
      this.showCurrentOneOf = false
      this.$nextTick(() => {
        this.showCurrentOneOf = true
        if (!this.currentOneOf) this.subModels.currentOneOf = {}
        else this.input(this.fixProperties(this.value), false, false)
        if (this.triggerChangeCurrentOneOf) {
          this.$nextTick(() => {
            this.triggerChangeCurrentOneOf = false
            this.change()
          })
        }
      })
    },
    subModels: {
      handler() {
        this.input(this.fixProperties(this.value), false, false)
        // this.input(this.fixProperties(this.modelValue), false, false)
      },
      deep: true
    }
  },
  methods: {
    isSection(prop, insideAllOf) {
      if (!prop) return false
      if (!prop.title) return false
      if (prop['x-fromUrl'] || prop['x-fromData'] || prop['contentMediaType'] || prop['x-display'] === 'file') return false
      if (prop.allOf) return true
      if (insideAllOf && (prop.anyOf || prop.oneOf)) return true
      if (prop.properties || Array.isArray(prop.items)) return true
      return false
    },
    initObjectContainer(model) {
      if (this.fullSchema.type !== 'object') return

      // Init subModels for allOf subschemas
      if (this.fullSchema.allOf) {
        this.fullSchema.allOf.forEach((allOf, i) => {
          this.subModels['allOf-' + i] = copy(model)
        })
      }

      // Case of a sub type selection based on a subSchemas
      this.currentOneOf = null
      if (this.subSchemas && !this.currentOneOf && this.subSchemasConstProp) {
        if (model && model[this.subSchemasConstProp.key]) {
          this.currentOneOf = this.subSchemas.find(item => item.properties[this.subSchemasConstProp.key].const === model[this.subSchemasConstProp.key])
        } else if (this.fullSchema.default) {
          this.currentOneOf = this.subSchemas.find(item => item.properties[this.subSchemasConstProp.key].const === this.fullSchema.default[this.subSchemasConstProp.key])
        }
      }

      // Init subModel for current subSchemas
      if (this.currentOneOf) {
        this.subModels.currentOneOf = copy(model)
      } else {
        this.subModels.currentOneOf = {}
      }
    },
    renderStepperStep(schema, subModelKey, childProp, step, isLast) {
      if (!childProp) return
      const modelKey = subModelKey || schema.key
      const hasError = this.dedupChildrenWithValidatedErrors.includes(modelKey)
      const props = {
        modelValue: step,
        value: step,
        editable: step < this.currentStep,
        complete: step < this.currentStep,
        rules: [() => !hasError]
      }
      return [h(resolveComponent('v-stepper-item'), props, () => [schema.title]), isLast ? null : h(resolveComponent('v-divider'))]
    },
    renderSection(schema, subModelKey, childProp, step, isLast) {
      if (!childProp) return
      const modelKey = subModelKey || schema.key
      const key = 'section-' + modelKey

      if (schema['x-display'] === 'hidden' || (schema.readOnly && this.fullOptions.hideReadOnly)) {
        return [childProp]
      }
      if (this.display === 'expansion-panels') {
        return [h(resolveComponent('v-expansion-panel'), { key }, () => [
          h(resolveComponent('v-expansion-panel-title'), { class: { 'error--text': this.dedupChildrenWithValidatedErrors.includes(modelKey) } }, [schema.title]),
          h(resolveComponent('v-expansion-panel-text'), { eager: true }, () => [childProp])
        ])]
      } else if (this.display === 'tabs') {
        return [
          h(resolveComponent('v-tab'), { key, value: `tab-${this.fullOptions.idPrefix}${this.dashKey}-${modelKey}` }, [
            h('span', { class: { 'error--text': this.dedupChildrenWithValidatedErrors.includes(modelKey) } }, [schema.title])
          ])
        ]
      } else if (this.display === 'stepper' || this.display === 'vertical-stepper') {
        return [h(resolveComponent('v-stepper-window-item'),
          { key, value: step, eager: true },
          () => [h(resolveComponent('v-card'), { tile: true, flat: true }, () => [
            h(resolveComponent('v-card-text'), { class: { 'pa-0': true } }, () => [childProp]),
            isLast ? null : h(resolveComponent('v-card-actions'), { class: { 'px-0': true } }, () => [h(resolveComponent('v-btn'), { color: 'primary',
              onClick: () => {
                if (childProp.ctx.ctx.validate(true)) {
                  console.log(childProp.ctx.ctx.validate(true))
                  this.currentStep += 1
                }
              } },
            () => this.fullOptions.messages.stepperContinue)])
          ])]
        )]
      }
    },
    renderWindowItems (schema, subModelKey, childProp) {
      if (!childProp) return
      const modelKey = subModelKey || schema.key
      const key = 'section-' + modelKey
      return h(resolveComponent('v-window-item'),
        { key, value: `tab-${this.fullOptions.idPrefix}${this.dashKey}-${modelKey}`, modelValue: `tab-${this.fullOptions.idPrefix}${this.dashKey}-${modelKey}`, eager: true },
        [h(resolveComponent('v-card'), { tile: true, flat: true }, [h(resolveComponent('v-card-text'), [childProp])])]
      )
    },
    renderChildProp(schema, subModelKey, sectionDepth, forceRequired, showSectionTitle) {
      this.objectContainerChildrenCount += 1
      let wrapper
      if (subModelKey) wrapper = this.subModels
      else if (Array.isArray(this.value)) wrapper = [...this.value]
      else wrapper = { ...this.value }

      const modelKey = subModelKey || schema.key

      // Manage default values
      let value = wrapper[modelKey]
      value = this.fixValueType(value, schema)
      if (value === undefined) {
        value = this.defaultValue(schema)
        if (schema.default !== undefined) value = copy(schema.default)
        if (value !== undefined && value !== null) {
          wrapper[modelKey] = value
          if (!subModelKey) this.input(wrapper, false, false)
        }
      }
      return h(resolveComponent('v-jsf'), {
        schema: { readOnly: this.fullSchema.readOnly, ...schema },
        value,
        modelRoot: this.modelRoot || this.value,
        modelValue: this.modelValue,
        modelKey,
        parentKey: `${this.fullKey}.`,
        required: forceRequired || !!(this.fullSchema.required && this.fullSchema.required.includes(schema.key)),
        options: { ...this.fullOptions, autofocus: this.fullOptions.autofocus && this.objectContainerChildrenCount === 1 },
        optionsRoot: this.initialOptions,
        sectionDepth,
        sharedData: this.sharedData,
        showSectionTitle,
        class: this.fullOptions.childrenClass,
        key: modelKey
      }, this.childScopedSlots())
    },
    renderObjectContainer() {
      if (!this.isObjectContainer) return
      if ([undefined, null].includes(this.value)) return []

      const flatChildren = []
      this.objectContainerChildrenCount = 0
      const sections = []
      if (this.fullSchema.properties) {
        this.fullSchema.properties.forEach((schema) => {
          if (this.isSection(schema)) {
            sections.push({ schema, subModelKey: null, forceRequired: false })
          } else {
            flatChildren.push(this.renderChildProp(schema, null, this.sectionDepth, false, false))
          }
        })
      }
      if (Array.isArray(this.fullSchema.items)) {
        this.fullSchema.items.forEach((schema, i) => {
          const forceRequired = this.value.length > i || (this.fullSchema.minItems && this.fullSchema.minItems > i)
          if (this.isSection(schema)) {
            sections.push({ schema, subModelKey: null, forceRequired })
          } else {
            flatChildren.push(this.renderChildProp(schema, null, this.sectionDepth, forceRequired, false))
          }
        })
      }
      if (this.fullSchema.allOf) {
        this.fullSchema.allOf.forEach((allOf, i) => {
          const schema = { ...allOf, type: 'object', key: '' + i }
          if (this.isSection(allOf, true)) {
            sections.push({ schema, subModelKey: 'allOf-' + i, forceRequired: false })
          } else {
            flatChildren.push(this.renderChildProp(schema, 'allOf-' + i, this.sectionDepth, false, false))
          }
        })
      }
      let sectionsChildren = []
      let stepperSteps = []
      const windowItems = []
      sections.forEach((section, i) => {
        const isSimpleSection = !['expansion-panels', 'tabs', 'stepper', 'vertical-stepper'].includes(this.display)
        const childProp = this.renderChildProp(section.schema, section.subModelKey, this.sectionDepth + 1, section.forceRequired, isSimpleSection)
        if (isSimpleSection) sectionsChildren.push(childProp)
        else sectionsChildren = sectionsChildren.concat(this.renderSection(section.schema, section.subModelKey, childProp, i + 1, i === sections.length - 1))
        if (this.display === 'tabs') windowItems.push(this.renderWindowItems(section.schema, section.subModelKey, childProp))
        if (this.display === 'stepper' || this.display === 'vertical-stepper') stepperSteps = stepperSteps.concat(this.renderStepperStep(section.schema, section.subModelKey, childProp, i + 1, i === sections.length - 1))
      })

      if (this.display === 'expansion-panels' && sectionsChildren.length) {
        sectionsChildren = [h(resolveComponent('v-expansion-panels'), { ...this.fullOptions.expansionPanelsProps, ...this.fullSchema['x-props'] }, sectionsChildren)]
      }
      if (this.display === 'tabs' && sectionsChildren.length) {
        const props = { ...this.fullOptions.tabsProps, ...this.fullSchema['x-props'] }
        if (this.currentTab && this.dedupChildrenWithValidatedErrors.includes(this.currentTab)) {
          props.sliderColor = 'error'
        }
        props.onChange = value => { this.currentTab = value.split('-').pop() }
        props['onUpdate:modelValue'] = value => { this.currentTab = value.split('-').pop() }
        sectionsChildren = [h('div', { style: 'width: 100%;' }, [h(resolveComponent('v-tabs'), props, sectionsChildren), h(resolveComponent('v-window'), { modelValue: this.currentTab, 'onUpdate:modelValue': value => { this.currentTab = value.split('-').pop() } }, windowItems)])]
      }
      if (this.display === 'stepper' && sectionsChildren.length) {
        const props = { ...this.fullOptions.stepperProps, ...this.fullSchema['x-props'], modelValue: this.currentStep, value: this.currentStep }
        props.style = 'width: 100%;'
        props['onUpdate:modelValue'] = value => { this.currentStep = value }
        sectionsChildren = [h(resolveComponent('v-stepper'), props, [
          h(resolveComponent('v-stepper-header'), stepperSteps),
          h(resolveComponent('v-stepper-window'), sectionsChildren)
        ])]
      }
      /* if (this.display === 'vertical-stepper' && sectionsChildren.length) {
        const props = { ...this.fullOptions.verticalStepperProps, ...this.fullSchema['x-props'], vertical: true, value: this.currentStep }
        const stepperChildren = []
        for (let i = 0; i < sectionsChildren.length; i++) {
          stepperChildren.push(stepperSteps[i * 2])
          stepperChildren.push(sectionsChildren[i])
        }
        props.style = 'width: 100%;'
        props.onChange = value => { this.currentStep = value }
        sectionsChildren = [h(resolveComponent('v-stepper'), props, stepperChildren)]
      } */

      if (this.subSchemas && this.subSchemas.length) {
        const props = {
          ...this.commonFieldProps,
          ...((this.subSchemasConstProp && this.subSchemasConstProp['x-props']) || {}),
          disabled: this.disabled || (this.subSchemasConstProp && this.subSchemasConstProp.readOnly),
          value: this.currentOneOf,
          modelValue: this.currentOneOf,
          label: (this.subSchemasConstProp && this.subSchemasConstProp.title) || this.fullSchema.title,
          items: this.subSchemas
            .filter(item => !item['x-if'] || !!this.getFromExpr(item['x-if']))
            .filter(item => item.properties && item.properties[this.subSchemasConstProp.key]),
          required: this.subSchemasRequired,
          clearable: !this.subSchemasRequired,
          itemValue: item => item.properties[this.subSchemasConstProp.key].const,
          itemText: item => item.title || item.properties[this.subSchemasConstProp.key].const,
          rules: this.subSchemasRules,
          returnObject: true,
          style: (this.subSchemasConstProp && this.subSchemasConstProp['x-style']) || '',
          onInput: value => {
            this.currentOneOf = value
            this.triggerChangeCurrentOneOf = true
          }
        }
        flatChildren.push(h(resolveComponent('v-select'), props, { append: this.renderTooltip(h) }))
        if (this.currentOneOf && this.showCurrentOneOf) {
          flatChildren.push(this.renderChildProp({ ...this.currentOneOf, type: 'object', title: null }, 'currentOneOf', this.sectionDepth + 1))
        }
      }
      return [h(resolveComponent('v-row'), { class: `ma-0 ${this.fullOptions.objectContainerClass}` }, () => [
        (this.showSectionTitle && h(resolveComponent('v-col'), { cols: 12, class: 'pa-0' }, [
          h('span', { class: 'py-2 ' + (this.fullOptions.sectionsTitlesClasses[this.sectionDepth - 1] || this.fullOptions.sectionsTitlesClasses[this.fullOptions.sectionsTitlesClasses.length - 1]) },
            [`${this.fullSchema.title}\xa0`]
          )
        ])),
        // display a local error only we don't already have an error displayed in the children
        (this.localRuleError && !this.dedupChildrenWithValidatedErrors.length) && h(resolveComponent('v-col'), { cols: 12, class: { 'px-0': true, 'error--text': true } }, () => this.localRuleError),
        // display the description as block of text on top of section
        this.fullSchema.description && !this.subSchemasConstProp && h(resolveComponent('v-col'), { cols: 12, class: { 'pa-0': true }, innerHTML: this.htmlDescription })]
        .concat(flatChildren).concat(sectionsChildren))
      ]
    },
    // pass an  extract of $slots from current container to a child by matching then removing the prefix
    /* childSlots(h, childKey) {
      return Object.keys(this.$slots)
        .filter(slot => slot.startsWith(`${childKey}.`) || slot.startsWith(`${childKey}-`))
        .map(slot => {
          const childSlot = slot.startsWith(`${childKey}.`) ? slot.replace(`${childKey}.`, '') : slot.replace(`${childKey}-`, '')
          return h('template', { slot: childSlot }, this.$slots[slot])
        })
    }, */
    childScopedSlots(childKey) {
      return Object.keys(this.$slots)
        .filter(slot => slot.startsWith('custom-') || slot.startsWith(`${childKey}.`) || slot.startsWith(`${childKey}-`) || slot === childKey)
        .reduce((a, slot) => {
          let childSlot = 'default'
          if (slot.startsWith(`${childKey}.`)) childSlot = slot.replace(`${childKey}.`, '')
          if (slot.startsWith(`${childKey}-`)) childSlot = slot.replace(`${childKey}-`, '')
          if (slot.startsWith(`custom-`)) childSlot = slot
          a[childSlot] = this.$slots[slot]
          return a
        }, {})
    }
  }
}
