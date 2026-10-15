<template>
  <div class="executions-log-table">
    <div class="search-container">
      <div class="search-panel">
        <input ref="searchField" autocomplete="off" class="search-field"
               name="searchField"
               placeholder="Search"
               v-model="searchText">
        <input :alt="isClearSearchButton ? 'Clear search' : 'Search'" :src="searchImage"
             class="search-button"
             type="image"
             @click="searchIconClickHandler">
      </div>
    </div>
    <table class="highlight striped">
      <thead>
      <tr>
        <th class="id-column" :class="showSort('id')" @click="sortBy('id')">ID</th>
        <th class="start_time-column" :class="showSort('startTime')" @click="sortBy('startTime')">Start Time</th>
        <th class="user-column" :class="showSort('user')" @click="sortBy('user')">User</th>
        <th class="script-column" :class="showSort('script')" @click="sortBy('script')">Script</th>
        <th class="status-column not-sortable">Status</th>
      </tr>
      </thead>
      <tbody :class="{reloading: loading}">
      <tr v-for="row in rows" :key="row.id" @click="rowClick(row)">
        <td>{{ row.id }}</td>
        <td>{{ row.startTimeString }}</td>
        <td>{{ row.user }}</td>
        <td>{{ row.script }}</td>
        <td>{{ row.fullStatus }}</td>
      </tr>
      </tbody>
    </table>
    <p v-if="loading && isEmpty" class="loading-text">History will appear here</p>
    <p v-else-if="isEmpty" class="empty-text">No executions found</p>
  </div>
</template>

<script>
import ClearIcon from '@/assets/clear.png'
import SearchIcon from '@/assets/search.png'
import {useHistoryStore} from '@/common/stores/history'

const SEARCH_DEBOUNCE_MS = 300

export default {
  name: 'executions-log-table',
  props: {
    rows: Array,
    rowClick: {
      type: Function
    }
  },

  data() {
    return {
      // initialised from the store, so that the search survives the table being re-mounted
      searchText: useHistoryStore().searchText,
      searchTimeoutId: null
    }
  },

  methods: {
    showSort: function (sortKey) {
      if (this.sortColumn === sortKey) {
        return this.order === 'asc' ? 'sorted asc' : 'sorted desc'
      }
    },

    sortBy: function (sortKey) {
      const order = this.sortColumn === sortKey && this.order === 'asc' ? 'desc' : 'asc'
      useHistoryStore().setSort(sortKey, order)
    },

    searchIconClickHandler() {
      if (this.searchText !== '') {
        this.searchText = '';
      }
      this.$nextTick(() => {
        this.$refs.searchField.focus();
      });
    },
  },

  watch: {
    searchText(newValue) {
      if (this.searchTimeoutId !== null) {
        clearTimeout(this.searchTimeoutId)
      }

      this.searchTimeoutId = setTimeout(() => {
        this.searchTimeoutId = null
        if (newValue !== useHistoryStore().searchText) {
          useHistoryStore().setSearch(newValue)
        }
      }, SEARCH_DEBOUNCE_MS)
    }
  },

  unmounted() {
    if (this.searchTimeoutId !== null) {
      clearTimeout(this.searchTimeoutId)
    }
  },

  computed: {
    loading() {
      return useHistoryStore().loading
    },

    sortColumn() {
      return useHistoryStore().sortColumn
    },

    order() {
      return useHistoryStore().order
    },

    isClearSearchButton() {
      return this.searchText !== '';
    },

    searchImage() {
      return this.isClearSearchButton ? ClearIcon : SearchIcon;
    },

    isEmpty() {
      return !this.rows || this.rows.length === 0
    }
  }
}
</script>

<style scoped>
.executions-log-table th  {
  cursor: pointer;
}

.executions-log-table th.not-sortable {
  cursor: default;
}

.executions-log-table tbody.reloading {
  opacity: 0.5;
}

.executions-log-table tbody > tr {
  cursor: pointer;
}

.executions-log-table .id-column {
  width: 10%;
}

.executions-log-table .start_time-column {
  width: 25%;
}

.executions-log-table .user-column {
  width: 25%;
}

.executions-log-table .script-column {
  width: 25%;
}

.executions-log-table .status-column {
  width: 15%;
}

.loading-text, .empty-text {
  color: var(--font-color-medium);
  font-size: 1.2em;
  text-align: center;
  margin-top: 1em;
}

.executions-log-table .sorted:after {
  display: inline-block;
  vertical-align: middle;
  width: 0;
  height: 0;
  margin-left: 5px;
  content: ""
}

.executions-log-table .sorted.asc:after {
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 4px solid var(--font-color-main);
}

.executions-log-table .sorted.desc:after {
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 4px solid var(--font-color-main);
}

.search-container {
  min-width: 200px;
  width: 50%;
}

.search-panel {
  display: flex;
}

.search-button {
  align-self: center;
}
</style>
