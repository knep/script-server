<template>
  <v-snackbar
    v-model="snackbar"
    :color="snackbarColor"
    :timeout="5000"
    location="bottom right"
  >
    {{ snackbarText }}
    <template #actions>
      <v-btn variant="text" @click="snackbar = false">Close</v-btn>
    </template>
  </v-snackbar>
</template>

<script>
import {useExecutionsStore} from '@/main-app/stores/executions'
import {STATUS_ERROR, STATUS_FINISHED, STATUS_EXECUTING, STATUS_INITIALIZING} from '@/main-app/stores/scriptExecutor'

export default {
  name: 'ExecutionNotifier',
  data() {
    return {
      snackbar: false,
      snackbarText: '',
      snackbarColor: 'primary',
      prevStatuses: {}
    }
  },
  computed: {
    executors() {
      return useExecutionsStore().executors
    },
    // A reactive signature that changes whenever any executor's status changes,
    // so the watcher fires without needing a deep watch on the map.
    statusSignature() {
      return Object.values(this.executors)
          .map(e => e.state.id + ':' + e.state.status)
          .join('|')
    }
  },
  watch: {
    statusSignature() {
      this.checkTransitions()
    }
  },
  mounted() {
    // Seed the baseline so executions reconnected on page load don't notify.
    this.syncStatuses()
  },
  methods: {
    syncStatuses() {
      for (const executor of Object.values(this.executors)) {
        this.prevStatuses[executor.state.id] = executor.state.status
      }
    },
    checkTransitions() {
      for (const executor of Object.values(this.executors)) {
        const id = executor.state.id
        const current = executor.state.status
        const previous = this.prevStatuses[id]

        if (current !== previous) {
          const wasRunning = previous === STATUS_EXECUTING || previous === STATUS_INITIALIZING
          if (wasRunning && (current === STATUS_FINISHED || current === STATUS_ERROR)) {
            this.notify(executor.state.scriptName, current === STATUS_FINISHED)
          }
          this.prevStatuses[id] = current
        }
      }
    },
    notify(scriptName, succeeded) {
      this.snackbarText = `${scriptName} ${succeeded ? 'finished' : 'failed'}`
      this.snackbarColor = succeeded ? 'primary' : 'error'
      this.snackbar = true

      // Native notification only when the app isn't focused and the user has
      // granted permission (requested on Execute — a user gesture).
      if (document.hidden && this.canNotify()) {
        try {
          new Notification(`Script ${succeeded ? 'finished' : 'failed'}`, {body: scriptName})
        } catch (e) {
          // some browsers throw if construction is not allowed — ignore
        }
      }
    },
    canNotify() {
      return typeof Notification !== 'undefined' && Notification.permission === 'granted'
    }
  }
}
</script>
