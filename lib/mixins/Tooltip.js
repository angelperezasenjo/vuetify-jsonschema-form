import { resolveComponent } from 'vue'
export default {
  data() {
    return {
      tooltip: {
        maxWidth: 200
      }
    }
  },
  mounted() {
    if (!this.htmlDescription) return
    if (this.$el && this.$el.getBoundingClientRect) this.tooltip.maxWidth = this.$el.getBoundingClientRect().left - 80
  },
  methods: {
    renderTooltip(h, slot) {
      console.log(this.fullOptions.tooltipProps)
      if (this.fullOptions.hideTooltips) return
      if (this.fullOptions.hideReadOnlyTooltips && (this.fullSchema.readOnly || this.fullOptions.readOnlyArrayItem)) return
      if (!this.htmlDescription) return

      return () =>
        h(resolveComponent('v-btn'), {
          icon: true
        },
        { default: () => [h(resolveComponent('v-icon'), this.fullOptions.icons.info), h(resolveComponent('v-tooltip'), {
          contentClass: 'vjsf-tooltip',
          activator: 'parent',
          persistent: false,
          ...this.fullOptions.tooltipProps
        }, { default: () => h('div', { style: `max-width: ${this.tooltip.maxWidth}px`, innerHTML: this.htmlDescription }) }
        )] })
    }
  }
}
