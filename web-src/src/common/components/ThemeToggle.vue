<template>
  <v-btn
    :icon="dark ? 'light_mode' : 'dark_mode'"
    :title="dark ? 'Switch to light mode' : 'Switch to dark mode'"
    variant="text"
    :color="color"
    density="compact"
    @click="toggle"
  />
</template>

<script>
import {isDarkActive, toggleTheme} from '@/common/utils/theme'

export default {
  name: 'ThemeToggle',
  props: {
    color: {
      type: String,
      default: 'primary'
    }
  },
  data() {
    return {
      dark: isDarkActive()
    }
  },
  methods: {
    toggle() {
      toggleTheme()
      this.dark = isDarkActive()
    }
  }
}
</script>
