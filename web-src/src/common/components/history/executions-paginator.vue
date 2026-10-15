<template>
  <div class="executions-paginator">
    <div class="page-size-panel">
      <label class="page-size-label" for="executions-page-size">Rows</label>
      <select id="executions-page-size" class="page-size-select"
              :value="pageSize"
              :disabled="loading"
              @change="pageSizeChanged">
        <option v-for="option in pageSizeOptions" :key="option" :value="option">{{ option }}</option>
      </select>
    </div>
    <span class="range-label">{{ rangeLabel }}</span>
    <div class="buttons-panel">
      <v-btn class="prev-button" icon="chevron_left" variant="text" density="comfortable"
             aria-label="Previous page"
             :disabled="prevDisabled"
             @click="prevPage"/>
      <v-btn class="next-button" icon="chevron_right" variant="text" density="comfortable"
             aria-label="Next page"
             :disabled="nextDisabled"
             @click="nextPage"/>
    </div>
  </div>
</template>

<script>
import {PAGE_SIZE_OPTIONS, useHistoryStore} from '@/common/stores/history'

export default {
  name: 'executions-paginator',

  data() {
    return {
      pageSizeOptions: PAGE_SIZE_OPTIONS
    }
  },

  methods: {
    nextPage() {
      useHistoryStore().nextPage()
    },

    prevPage() {
      useHistoryStore().prevPage()
    },

    pageSizeChanged(event) {
      useHistoryStore().setPageSize(parseInt(event.target.value))
    }
  },

  computed: {
    store() {
      return useHistoryStore()
    },

    pageSize() {
      return this.store.pageSize
    },

    loading() {
      return this.store.loading
    },

    rangeStart() {
      if (this.store.executions.length === 0) {
        return 0
      }
      return this.store.cursorStack.length * this.store.pageSize + 1
    },

    rangeEnd() {
      if (this.store.executions.length === 0) {
        return 0
      }
      return this.rangeStart + this.store.executions.length - 1
    },

    rangeLabel() {
      if (this.store.executions.length === 0) {
        return '0 of ' + this.store.total
      }
      return this.rangeStart + '-' + this.rangeEnd + ' of ' + this.store.total
    },

    prevDisabled() {
      return !this.store.hasPrev || this.loading
    },

    nextDisabled() {
      return !this.store.hasNext || this.loading
    }
  }
}
</script>

<style scoped>
.executions-paginator {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  padding: 8px 0;
  color: var(--font-color-medium);
}

.page-size-panel {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-size-select {
  padding: 2px 4px;
  border: 1px solid var(--separator-color, rgba(0, 0, 0, 0.2));
  border-radius: 4px;
  background: var(--background-color);
  color: var(--font-color-main);
}

.buttons-panel {
  display: flex;
  gap: 4px;
}
</style>
