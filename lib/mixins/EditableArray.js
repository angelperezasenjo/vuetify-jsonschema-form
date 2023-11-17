import copy from 'fast-copy'
import selectUtils from '../utils/select'
import { h, resolveComponent } from 'vue'

export default {
  data() {
    return {
      editabledArrayProp: {
        currentDialog: null,
        editItem: null,
        editedItems: {}
      }
    }
  },
  computed: {
    isEditableArray() {
      if (this.resolvedSchema.type === 'array' && this.resolvedSchema.items && this.resolvedSchema.items.type === 'object') return true
    },
    readonlyItemSchema() {
      if (!this.fullSchema || !this.fullSchema.items) return

      const schema = copy(this.fullSchema.items)
      // hide titles that are displayed in headers and do not need a text field
      // but do not remove them, we need them for validation
      if (this.itemTitle) {
        if (schema.properties && schema.properties[this.itemTitle] && typeof schema.properties[this.itemTitle] === 'object') {
          schema.properties[this.itemTitle]['x-style'] = 'display: none;'
        }
        if (schema.oneOf) {
          schema.oneOf.forEach((value) => {
            if (value.properties[this.itemTitle]) {
              value.properties[this.itemTitle]['x-style'] = 'display: none;'
            }
          })
        }
        if (this.fullSchema.items.allOf) {
          schema.allOf.forEach((value) => {
            if (value.properties[this.itemTitle]) {
              value.properties[this.itemTitle]['x-style'] = 'display: none;'
            }
          })
        }
      }
      return schema
    }
  },
  methods: {
    renderArrayItemModal(item, i) {
      const isNew = i === -1
      let itemProperty
      if (this.editabledArrayProp.currentDialog === i) {
        itemProperty = this.renderArrayItemEdit(i, true)
      }

      const close = () => {
        itemProperty.ctx.ctx.resetValidation()
        this.editabledArrayProp.currentDialog = null
      }
      const on = {}
      if (!this.fullOptions.dialogProps.persistent) on['click:outside'] = close
      return h(resolveComponent('v-dialog'), { ...this.fullOptions.dialogProps, value: this.editabledArrayProp.currentDialog === i, closeOnContentClick: false },
        { default: () => [
          h(resolveComponent('v-card'), this.fullOptions.dialogCardProps, [
            h(resolveComponent('v-card-title'), this.itemTitle && item[this.itemTitle]),
            h(resolveComponent('v-card-text'), [itemProperty]),
            h(resolveComponent('v-card-actions'), [
              h(resolveComponent('v-spacer')),
              h(resolveComponent('v-btn'), { text: true,
                onClick: close,
                id: this.fullOptions.idPrefix + this.dashKey + '--dialog-cancel-button',
                class: { 'vjsf-array-dialog-cancel-button': true } }, 'cancel'),
              h(resolveComponent('v-btn'), { color: 'primary',
                onClick: () => {
                  if (!itemProperty.componentInstance.validate(true)) return
                  const value = [...this.modelValue]
                  if (isNew) {
                    this.editabledArrayProp.editedItems[this.modelValue.length] = true
                    value.push(this.editabledArrayProp.editItem)
                  } else {
                    this.editabledArrayProp.editedItems[i] = true
                    value[i] = { ...this.editabledArrayProp.editItem }
                  }
                  this.input(value)
                  this.change()
                  this.shouldValidate = true
                  this.editabledArrayProp.currentDialog = null
                },
                id: this.fullOptions.idPrefix + this.dashKey + '--dialog-ok-button',
                class: { 'vjsf-array-dialog-ok-button': true }
              }, 'ok')
            ])
          ])
        ],
        activator: () => this.renderArrayItemEditButton(item, i) }
      )
    },
    renderArrayItemRO(item, i) {
      const modelKey = `item-${i}`
      const renderOptions = {
        schema: this.readonlyItemSchema,
        // value: item,
        modelValue: item,
        modelRoot: this.modelRoot || this.modelValue,
        modelKey,
        parentKey: `${this.fullKey}.`,
        options: { ...this.fullOptions, disableAll: true, readOnlyArrayItem: true },
        optionsRoot: this.initialOptions,
        sectionDepth: this.sectionDepth + 1,
        separateValidation: false,
        sharedData: this.sharedData,
        ref: modelKey
      }
      if (this.options.autoFixArrayItems) {
        renderOptions.onInput = (itemValue) => {
          // even if it is readOnly we listen to changes in order to fill default values in array
          // already present in the model
          if (!this.editabledArrayProp.editedItems[i]) {
            const value = [...this.modelValue]
            value[i] = itemValue
            this.input(value)
          }
        }
      }
      return h(resolveComponent('v-jsf'), renderOptions, ...this.childScopedSlots(this.fullSchema.key))
    },
    renderArrayItemEditButton(item, i, isCurrentInlineEdit) {
      const isNew = i === -1
      const fabIcon = isCurrentInlineEdit || isNew
      return h(resolveComponent('v-btn'), {
        onClick: () => {
          if (isNew && this.fullOptions.editMode === 'inline') {
            const editItem = copy(item)
            const value = [...this.modelValue]
            value.push(editItem)
            this.editabledArrayProp.currentDialog = value.length - 1
            this.editabledArrayProp.editItem = editItem
            this.input(value)
            this.change()
          } else if (this.editabledArrayProp.currentDialog === i) {
            this.editabledArrayProp.editItem = null
            this.editabledArrayProp.currentDialog = null
            this.change()
          } else {
            this.editabledArrayProp.editItem = copy(item)
            this.editabledArrayProp.currentDialog = i
            // show validation errors right away when editing an item
            if (this.fullOptions.editMode === 'inline') {
              this.$nextTick(() => this.childrenInputs[`item-${i}`].validate(true))
            }
          }
        },
        id: this.fullOptions.idPrefix + this.dashKey + '-' + (isNew ? '-add' : i + '--edit') + '-button',
        class: { 'vjsf-array-add-button': true, 'ml-3': isNew },
        icon: !fabIcon,
        fab: fabIcon,
        small: isNew,
        'x-small': isCurrentInlineEdit,
        color: 'primary',
        depressed: isCurrentInlineEdit }, [
        h(resolveComponent('v-icon'), isNew ? this.fullOptions.icons.add : this.fullOptions.icons.edit)
      ])
    },
    renderArrayItemEdit(i, autofocus) {
      const options = { ...this.fullOptions, autofocus }
      if (!this.fullOptions.idPrefix.endsWith('--dialog--')) {
        options.idPrefix = this.fullOptions.idPrefix + '--dialog--'
      }

      return h(resolveComponent('v-jsf'), {
        schema: this.fullSchema.items,
        // value: this.editabledArrayProp.editItem,
        modelValue: this.editabledArrayProp.editItem,
        modelRoot: this.modelRoot || this.modelValue,
        modelKey: `item-${i}`,
        parentKey: `${this.fullKey}.`,
        options,
        optionsRoot: this.initialOptions,
        sectionDepth: this.sectionDepth + 1,
        separateValidation: this.fullOptions.editMode !== 'inline',
        sharedData: this.sharedData,
        ref: 'item-' + i,
        onError: e => this.$emit('error', e),
        onInput: itemValue => {
          this.editabledArrayProp.editItem = itemValue
          if (this.fullOptions.editMode === 'inline') {
            const value = [...this.modelValue]
            value[i] = itemValue
            this.input(value)
          }
        },
        'onUpdate:modelValue': () => {
          if (this.fullOptions.editMode === 'inline') {
            this.change()
          }
        }
      },
      { ...this.childScopedSlots(this.fullSchema.key) })
    },
    renderArrayItemMenu(item, header, isCurrentInlineEdit) {
      if (this.disabled || this.fromUrl || this.fullSchema.fromData) return
      const menuItems = []

      for (const operation of this.fullOptions.arrayOperations) {
        if (operation === 'duplicate') {
          menuItems.push({
            title: this.fullOptions.messages.duplicate,
            color: 'default',
            icon: this.fullOptions.icons.duplicate,
            disabled: false,
            onClick: () => {
              console.log('duplicate')
              const index = this.modelValue.findIndex(i => i === item)
              const value = [...this.modelValue]
              value.splice(index, 0, { ...item })
              this.input(value)
              this.change()
              this.shouldValidate = true
              header.ctx.ctx.validate()
            }
          })
        }

        if (operation === 'delete') {
          menuItems.push({
            title: this.fullOptions.messages.delete,
            color: 'warning',
            icon: this.fullOptions.icons.delete,
            disabled: isCurrentInlineEdit,
            onClick: () => {
              const value = this.modelValue.filter(i => i !== item)
              this.input(value)
              this.change()
              this.shouldValidate = true
              header.componentInstance.validate()
            }
          })
        }

        if (operation === 'copy' && this.fullSchema['x-arrayGroup']) {
          menuItems.push({
            title: this.fullOptions.messages.copy,
            color: 'default',
            icon: this.fullOptions.icons.copy,
            disabled: false,
            onClick: () => {
              this.sharedData['clipboard_' + this.fullSchema['x-arrayGroup']] = item
            }
          })
        }

        if (operation === 'paste' && this.fullSchema['x-arrayGroup']) {
          menuItems.push({
            title: this.fullOptions.messages.paste,
            color: 'primary',
            icon: this.fullOptions.icons.paste,
            disabled: !(this.sharedData['clipboard_' + this.fullSchema['x-arrayGroup']]),
            onClick: () => {
              if (this.fullOptions.editMode === 'inline') {
                this.editabledArrayProp.editItem = null
                this.editabledArrayProp.currentDialog = null
              }
              const index = this.modelValue.findIndex(i => i === item)
              const value = [...this.modelValue]
              value[index] = this.sharedData['clipboard_' + this.fullSchema['x-arrayGroup']]
              this.input(value)
              this.change()
              this.shouldValidate = true
              header.componentInstance.validate()
            }
          })
        }
      }

      if (!menuItems.length) return

      // if there is only one item, do not create a menu but instead a single button
      if (menuItems.length === 1) {
        return h(resolveComponent(resolveComponent('v-btn')), {
          icon: true,
          disabled: menuItems[0].disabled,
          onClick: menuItems[0].onClick,
          title: menuItems[0].title,
          class: 'ml-1'
        }, [h(resolveComponent(resolveComponent('v-icon')), { color: menuItems[0].color }, [menuItems[0].icon])])
      }
      return h(resolveComponent(resolveComponent('v-menu')), {
        offsetY: true, left: true },
      {
        activator: ({ props }) => h(resolveComponent('v-btn'), {
          ...props,
          icon: true,
          title: this.fullOptions.messages.openMenu,
          class: 'ml-1'
        }, [h(resolveComponent(resolveComponent('v-icon')), this.fullOptions.icons.arrayMenu)]),
        default: () => h(resolveComponent(resolveComponent('v-list')), { class: 'pa-0', dense: true }, menuItems.map(menuItem => h(resolveComponent('v-list-item'), {
          onClick: menuItem.onClick,
          disabled: menuItem.disabled
        }, [
          h(resolveComponent('v-list-item-icon'), { class: 'mr-2' }, [h(resolveComponent('v-icon'), { color: menuItem.color, small: true }, [menuItem.icon])]),
          h(resolveComponent('v-list-item-content'), {}, [h(resolveComponent('v-list-item-title'), {}, [menuItem.title])])
        ])))
      })
    },
    renderEditableArray() {
      if (!this.isEditableArray) return
      const headerChildren = []
      if (!this.disabled && !this.fromUrl && !this.fullSchema.fromData && this.fullOptions.arrayOperations.includes('create')) {
        const item = this.fullSchema.items.default || this.defaultValue(this.fullSchema.items)
        if (this.fullOptions.editMode === 'inline') {
          headerChildren.push(this.renderArrayItemEditButton(item, -1))
        } else {
          headerChildren.push(this.renderArrayItemModal(item, -1))
        }
      }
      const header = h(resolveComponent('v-input'), {
        class: 'mt-2 mb-3 pr-1 vjsf-array-header',
        label: this.label,
        rules: this.rules,
        modelValue: this.modelValue,
        validateOnBlur: !this.shouldValidate,
        hideDetails: 'auto'
      }, headerChildren)

      const sortable = !this.fullOptions.disableSorting && !this.disabled

      let listItems
      if (this.modelValue && this.modelValue.length) {
        listItems = this.modelValue.filter(item => !!item).map((item, i) => {
          let editAction
          const isCurrentInlineEdit = this.fullOptions.editMode === 'inline' && this.editabledArrayProp.currentDialog === i
          if (!this.disabled && this.fullOptions.arrayOperations.includes('update')) {
            if (this.fullOptions.editMode === 'inline') {
              editAction = this.renderArrayItemEditButton(item, i, isCurrentInlineEdit)
            } else {
              editAction = this.renderArrayItemModal(item, i)
            }
          }

          const actions = h(resolveComponent('v-card-actions'), { class: 'pa-0' }, [h(resolveComponent('v-spacer'), editAction, this.renderArrayItemMenu(item, header, isCurrentInlineEdit))])

          let itemChild, cardStyle, itemKey
          if (isCurrentInlineEdit) {
            itemChild = this.renderArrayItemEdit(i, false)
            itemKey = 'item-edit-' + i
          } else {
            itemChild = this.renderArrayItemRO(item, i)
            itemKey = this.cached(`item-key-${i}`, { item }, () => `${i}-${new Date().getTime()}`)
            if (sortable) cardStyle = 'cursor: move;'
          }

          const titleClass = 'py-2 pr-2 ' + this.fullOptions.arrayItemsTitlesClasses[this.sectionDepth] || this.fullOptions.arrayItemsTitlesClasses[this.fullOptions.arrayItemsTitlesClasses.length - 1]

          let cardChildren = [
            h(resolveComponent('v-card-title'), { primaryTitle: true, class: titleClass }, [selectUtils.getObjectTitle(item, this.itemTitle, this.fullSchema), h(resolveComponent('v-spacer'), actions)]),
            h(resolveComponent('v-card-text'), [itemChild])
          ]

          const hasError = this.dedupChildrenWithValidatedErrors.includes(`item-${i}`)
          if (isCurrentInlineEdit) {
            cardChildren = [h(resolveComponent('v-alert'), { color: hasError ? 'error' : 'primary', 'colored-border': true, border: 'left', class: 'pa-0 pl-2 ma-0' }, cardChildren)]
          } else if (hasError) {
            cardChildren = [h(resolveComponent('v-alert'), { color: 'error', outlined: true, class: 'pa-0 ma-0' }, cardChildren)]
          } else {
            // this alert is not necessary at first sight, but without it the inside components are not reused
            // when hasError changes and we can enter infinite loop where validation oscillates between ok/ko
            cardChildren = [h(resolveComponent('v-alert'), { color: 'default', outlined: true, class: 'pa-0 ma-0 vjsf-invisible-alert' }, cardChildren)]
          }
          const directives = []
          if (isCurrentInlineEdit) {
            directives.push({
              name: 'click-outside',
              value: {
                handler: () => {
                  // exclude the case where the outside click triggered edition of another item
                  if (this.editabledArrayProp.currentDialog === i) {
                    if (this.fullOptions.editMode === 'inline') {
                      this.editabledArrayProp.editItem = null
                      this.editabledArrayProp.currentDialog = null
                      this.change()
                    }
                  }
                },
                // cf https://github.com/vuetifyjs/vuetify/blob/master/packages/vuetify/src/components/VDialog/VDialog.ts#L290
                include: this.getOpenDependentElements
              }
            })
          }

          let itemClass = 'py-1 vjsf-array-item'
          console.log(cardChildren)
          if (isCurrentInlineEdit) itemClass += ' vjsf-array-item-active'
          return h(resolveComponent('v-col'), { ...this.fullOptions.arrayItemColProps, class: itemClass, key: itemKey }, [h(resolveComponent('v-card'), {
            ...this.fullOptions.arrayItemCardProps,
            style: cardStyle,
            directives
          }, cardChildren)
          ])
        })
      }

      let newValue
      const list = !sortable ? h(resolveComponent('v-row'), { class: 'vjsf-array' }, listItems) : h(resolveComponent('draggable'), {
        value: this.modelValue,
        modelValue: this.modelValue,
        group: this.fullSchema['x-arrayGroup'] || this.fullKey,
        ...this.fullOptions.sortableOptions,
        class: 'row draggable vjsf-array',
        'onUpdate:modelValue': async (evt) => {
          if (evt.added) await this.$nextTick()
          this.editabledArrayProp.editItem = null
          this.editabledArrayProp.currentDialog = null
          this.input(newValue)
          this.change()
          this.shouldValidate = true
        },
        input: async (value) => {
          newValue = value
        }
      }, listItems)

      return [header, list]
    }
  }
}
