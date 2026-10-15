<template>
  <div class="container">
    <PageProgress v-if="initialLoading && !disableProgressIndicator"/>
    <template v-else>
      <executions-log-table :rowClick="goToLog" :rows="executionRows"/>
      <executions-paginator/>
    </template>
  </div>
</template>

<script>
import PageProgress from '../PageProgress';
import ExecutionsLogTable from './executions-log-table'
import ExecutionsPaginator from './executions-paginator'
import {useHistoryStore} from '@/common/stores/history'

export default {
  name: 'executions-log',

  props: {
    disableProgressIndicator: {
      type: Boolean,
      default: false
    }
  },
  components: {
    'executions-log-table': ExecutionsLogTable,
    'executions-paginator': ExecutionsPaginator,
    PageProgress
  },

  data() {
    return {
      // the full-page progress is shown only for the first load, so that paging, sorting and
      // searching do not re-mount the table (and lose the search field focus)
      initialLoadDone: false
    }
  },

  mounted() {
    useHistoryStore().init().finally(() => {
      this.initialLoadDone = true
    })
  },

  methods: {
    goToLog(execution_entry) {
      this.$router.push({path: this.$route.path + '/' + execution_entry.id})
    }
  },

  computed: {
    executionRows() {
      return useHistoryStore().executions
    },
    initialLoading() {
      return !this.initialLoadDone && useHistoryStore().loading
    }
  }
}


</script>

<style scoped>
div.executions-log {
  height: 100%;
}

div.progress {
  top: 45%;
}

div.indeterminate {
  max-width: 480px;
}
</style>