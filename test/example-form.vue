<template>
  <v-form
    ref="form"
    v-model="valid"
  >
    <slot
      v-bind="{modelWrapper, options, schema, logEvent}"
    />
  </v-form>
</template>

<script>

export default {
  props: {
    modelWrapper: { type: Object, required: true },
    schema: { type: Object, required: true },
    options: { type: Object, required: true },
    logEvent: { type: Function, required: true }
  },
  setup(props) {
    console.log('props:', props)
  },
  data: () => ({
    valid: false
  })
}
</script>

<style lang="css" scoped>
</style>
