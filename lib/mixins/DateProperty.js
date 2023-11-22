// 1 => 01, 12 => 12
import { h, resolveComponent } from 'vue'

const padTimeComponent = (val) => {
  const s = '' + val
  return s.length === 1 ? '0' + s : s
}

// storing ISO times with the user's timezone offset is more dense in information that always storing the base ISO date
// this way the application can either use the localized time or the ISO time by chosing to interpret or not the offset part
// cf https://usefulangle.com/post/30/javascript-get-date-time-with-offset-hours-minutes
// 2020-04-03T19:07:43.152Z => 2020-04-03T21:07:43+02:00
const getDateTimeWithOffset = (date) => {
  const offsetMinutes = date.getTimezoneOffset()
  const offsetAbs = `${padTimeComponent(parseInt(Math.abs(offsetMinutes / 60)))}:${padTimeComponent(Math.abs(offsetMinutes % 60))}`
  let offset
  if (offsetMinutes < 0) offset = `+${offsetAbs}`
  else if (offsetMinutes > 0) offset = `-${offsetAbs}`
  else offset = 'Z'
  return `${date.getFullYear()}-${padTimeComponent(date.getMonth() + 1)}-${padTimeComponent(date.getDate())}T${padTimeComponent(date.getHours())}:${padTimeComponent(date.getMinutes())}:${padTimeComponent(date.getSeconds())}${offset}`
}

// get the the date and short time components expected by date-time picker from a full date
// 2020-04-03T21:07:43+02:00 => ['2020-04-03', '19:07']
const getDateTimeParts = (date) => {
  return [`${date.getFullYear()}-${padTimeComponent(date.getMonth() + 1)}-${padTimeComponent(date.getDate())}`, `${padTimeComponent(date.getHours())}:${padTimeComponent(date.getMinutes())}`]
}


// get a full date-time from the date and time parts edited by date-time picker
// ['2020-04-03', '19:07'] => 2020-04-03T21:07:43+02:00
  const getDateTime = (parts) => {
    if (!Array.isArray(parts) || parts.length < 2) {
      throw new Error('Invalid date parts');
    }

    const date = new Date();
    const dateParts = parts[0].split('-');
    const timeParts = parts[1].split(':');

    if (dateParts.length < 3 || timeParts.length < 2) {
      throw new Error('Invalid date or time format');
    }

    date.setFullYear(Number(dateParts[0]));
    date.setMonth(Number(dateParts[1]) - 1);
    date.setDate(Number(dateParts[2]));
    date.setHours(Number(timeParts[0] || '00'));
    date.setMinutes(Number(timeParts[1] || '00'));
    date.setSeconds(0);

    return getDateTimeWithOffset(date);
  }
// get the short time representation expected by vuetify from a longer ISO time
const getShortTime = (time) => {
  if (!time) return ''
  return time.slice(0, 5)
}

const getLongTime = (time) => {
  return time + ':00Z'
}

const formatDate = (date) => {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const formattedMonth = month < 10 ? `0${month}` : `${month}`
  const formattedDay = day < 10 ? `0${day}` : `${day}`

  return `${formattedMonth}/${formattedDay}/${year}`
}

export default {
  methods: {
    renderDateProp() {
      if (this.fullSchema.type !== 'string' || !['date', 'date-time', 'time'].includes(this.fullSchema.format)) return

      const VTab = resolveComponent('v-tab')
      const VTabs = resolveComponent('v-tabs')
      const VDatePicker = resolveComponent('v-date-picker')
      const VTextField = resolveComponent('v-text-field')
      const VMenu = resolveComponent('v-menu')

      let child
      const prependIcon = this.fullOptions.icons.calendar
      if (this.fullSchema.format === 'date') {
        const VDatePicker = resolveComponent('v-date-picker')
        child = h(VDatePicker, {
          ...this.fullOptions.datePickerProps,
          locale: this.fullOptions.locale,
          modelValue: this.modelValue instanceof Date ? this.modelValue : new Date(this.modelValue),
          'onUpdate:modelValue': (value) => {
            if (!(value instanceof Date)) return
            this.dateProp.menu = false
            // formatDate (MM/DD/YYYY)
            this.input(formatDate(value))
            this.change()
          }
        })
      }

      return [h(VMenu, {
        modelValue: this.dateProp.menu,
        disabled: this.disabled,
        closeOnContentClick: false,
        origin: 'scale-transition',
        offsetY: true,
        fullWidth: true,
        minWidth: '290px',
        'onUpdate:modelValue': value => {
          this.dateProp.menu = value
          this.dateProp.tab = 'tab-date'
        }
      }, {
        activator: ({ props }) => {
          return h(VTextField, {
            ...props,
            ...this.commonFieldProps,
            modelValue: this.modelValue,
            clearable: !this.required,
            readonly: true,
            prependIcon,
            'onUpdate:modelValue': value => this.input(value),
            // onChange: () => this.change()
          }, {
            append: () => this.renderTooltip()
          })
        },
        default: () => [
          h(VTabs, {
            modelValue: this.dateProp.tab,
            'onUpdate:modelValue': value => { this.dateProp.tab = value, this.dateProp.tab = 'tab-date' },
            class: 'vjsf-date-time'
          }),
          child
        ]
      }
      )]
    }
  }
}
/*
Código comentando por si más adelante añadeb
el uso de timepicker y data-picker con reloj.
En vuetify 3 se ha quutado v-items y este codigo funciona con v-tabs
Para ser compatible con vuetify 3

const VIcon = resolveComponent('v-icon')

if (this.fullSchema.format === 'time') {
        /* child = h(VTimePicker, {
          ...this.fullOptions.timePickerProps,
          locale: this.fullOptions.locale,
          value: getShortTime(this.modelValue),
          'onUpdate:modelValue': value => this.input(getLongTime(value)),
          'onChange': () => this.change()
        })
        prependIcon = this.fullOptions.icons.clock
      } else if (this.fullSchema.format === 'date') {
        child = h(VDatePicker, {
          ...this.fullOptions.timePickerProps,
          locale: this.fullOptions.locale,
          modelValue: getShortTime(this.modelValue),
          'onUpdate:modelValue': value => this.input(getLongTime(value)),
          'onChange': () => this.change()
        })

      } /* else {
        if (this.modelValue !== this.dateProp.lastValue) this.dateProp.parts = getDateTimeParts(new Date(this.modelValue))
        this.dateProp.lastValue = this.modelValue
        const setValue = () => {
          if (this.dateProp.parts[1]) {
            const newValue = getDateTime(this.dateProp.parts)
            this.input(newValue)
            this.change()
          }
        }
        tabs = [
          h(VTab, { href: '#tab-date' }, [h(VIcon, [this.fullOptions.icons.calendar])]),
          h(VTab, { href: '#tab-time', disabled: !this.dateProp.parts[0] }, [h(VIcon, [this.fullOptions.icons.clock])])
        ]

        if (this.dateProp.tab === 'tab-date') {
          tabContent = h(VDatePicker, {
            ...this.fullOptions.datePickerProps,
            locale: this.fullOptions.locale,
            value: this.dateProp.parts[0],
            'onUpdate:modelValue': value => { this.dateProp.parts[0] = value; this.dateProp.tab = 'tab-time'; setValue() }
          })
        } else if (this.dateProp.tab === 'tab-time') {
          tabContent = h(VDatePicker, {
            ...this.fullOptions.timePickerProps,
            locale: this.fullOptions.locale,
            value: this.dateProp.parts[1],
            'onUpdate:modelValue': value => { this.dateProp.parts[1] = value; setValue() }
          })
        }

        Esta parte es dentro del v-menu añadiendo tabContent
        default: () => [
          h(VTabs, {
            grow: true,
            value: this.dateProp.tab,
            'onUpdate:modelValue': value => { this.dateProp.tab = value },
            class: 'vjsf-date-time'
          }, tabs),
          tabContent
        ],
      }
*/
