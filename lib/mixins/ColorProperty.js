import { h, resolveComponent } from 'vue'

export default {
  computed: {
    isColorProp() {
      return this.resolvedSchema.type === 'string' && (this.resolvedSchema.format === 'hexcolor' || this.display === 'color-picker')
    }
  },
  methods: {
    renderColorProp() {
      if (!this.isColorProp) return

      const defaultSlot = () => h(resolveComponent('v-color-picker'), {
        flat: true,
        ...this.fullOptions.colorPickerProps,
        ...this.fullSchema['x-props'],
        modelValue: this.modelValue || '#FF0000',
        'onUpdate:modelValue': val => {
          this.$emit('update:modelValue', val)
          this.input(val)
          this.change()
        }
      })

      return [
        h(resolveComponent('v-input'), {
          style: {
            display: 'flex !important',
            marginBottom: '1.5rem'
          },
          modelValue: this.modelValue,
          name: this.fullKey,
          required: this.required,
          rules: this.rules,
          disabled: this.disabled,
          ...this.fullOptions.fieldProps
        }, {
          default: () => this.label,
          append: () => [
            h(resolveComponent('v-menu'), {
              closeOnContentClick: false,
              closeOnClick: true
            }, {
              activator: ({ props }) => h('div', {
                ...props,
                style: `background-color: ${this.modelValue};margin-left: 10px;`,
                class: this.modelValue ? 'color-picker-trigger' : 'color-picker-trigger color-picker-trigger-empty'
              }),
              default: defaultSlot
            }), this.renderTooltip()
          ]
        })
      ]
    }
  }
}
