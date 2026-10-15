import {defineStore} from 'pinia'
import {isBlankString, isEmptyString, isNull, logError} from '@/common/utils/common'
import {axiosInstance} from '@/common/utils/axios_utils'

export const DEFAULT_PAGE_SIZE = 25
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250, 500]
export const DEFAULT_SORT_COLUMN = 'startTime'
export const DEFAULT_ORDER = 'desc'

export const useHistoryStore = defineStore('history', {
    state: () => ({
        executions: [],
        selectedExecution: null,
        selectedExecutionId: null,
        loading: false,
        detailsLoading: false,
        pageSize: DEFAULT_PAGE_SIZE,
        total: 0,
        searchText: '',
        sortColumn: DEFAULT_SORT_COLUMN,
        order: DEFAULT_ORDER,
        // cursors of the pages visited before the current one; its length is also the current page index
        cursorStack: [],
        currentCursor: null,
        nextCursor: null,
        // incremented per request, so that a late response of an outdated request is dropped
        requestToken: 0
    }),
    getters: {
        hasNext: (state) => !isNull(state.nextCursor),
        hasPrev: (state) => state.cursorStack.length > 0
    },
    actions: {
        init() {
            this.selectedExecution = null
            this.selectedExecutionId = null

            return this.loadFirstPage()
        },

        loadFirstPage() {
            return this.loadPage(null, [])
        },

        nextPage() {
            if (!this.hasNext) {
                return Promise.resolve()
            }

            return this.loadPage(this.nextCursor, [...this.cursorStack, this.currentCursor])
        },

        prevPage() {
            if (!this.hasPrev) {
                return Promise.resolve()
            }

            const cursorStack = [...this.cursorStack]
            const cursor = cursorStack.pop()

            return this.loadPage(cursor, cursorStack)
        },

        setPageSize(pageSize) {
            this.pageSize = pageSize

            return this.loadFirstPage()
        },

        setSearch(searchText) {
            this.searchText = isNull(searchText) ? '' : searchText

            return this.loadFirstPage()
        },

        setSort(column, order) {
            this.sortColumn = column
            this.order = order

            return this.loadFirstPage()
        },

        loadPage(cursor, cursorStack) {
            const requestToken = ++this.requestToken
            this.loading = true

            const params = {
                limit: this.pageSize,
                sort: this.sortColumn,
                order: this.order
            }
            if (!isBlankString(this.searchText)) {
                params.search = this.searchText.trim()
            }
            if (!isEmptyString(cursor)) {
                params.after = cursor
            }

            return axiosInstance.get('history/execution_log/short', {params})
                .then(({data}) => {
                    if (requestToken !== this.requestToken) return

                    const records = isNull(data) || isNull(data.records) ? [] : data.records
                    this.executions = records.map(log => translateExecutionLog(log))
                    this.total = isNull(data) || isNull(data.total) ? 0 : data.total
                    this.nextCursor = isNull(data) || isNull(data.nextCursor) ? null : data.nextCursor
                    this.currentCursor = isNull(cursor) ? null : cursor
                    this.cursorStack = cursorStack
                    this.loading = false
                })
                .catch(error => {
                    if (requestToken === this.requestToken) {
                        this.loading = false
                    }
                    logError(error)
                })
        },

        selectExecution(executionId) {
            if (isEmptyString(executionId)) {
                this.selectedExecutionId = executionId
                this.selectedExecution = null
                this.detailsLoading = false
                return
            }

            let execution = this.executions.find(e => e.id === executionId)
            if (isNull(execution)) {
                execution = {id: executionId, user: 'Unknown', script: 'Unknown'}
            }
            this.selectedExecutionId = executionId
            this.selectedExecution = execution
            this.detailsLoading = true

            axiosInstance.get('history/execution_log/long/' + executionId)
                .then(({data: incomingLog}) => {
                    if (executionId !== this.selectedExecutionId) return
                    this.selectedExecution = translateExecutionLog(incomingLog)
                    this.detailsLoading = false
                })
                .catch(error => logError(error))
        }
    }
})

export function translateExecutionLog(log) {
    log.startTimeString = getStartTimeString(log)
    log.fullStatus = getFullStatus(log)
    return log
}

function getStartTimeString(log) {
    if (!isNull(log.startTime)) {
        const startTime = new Date(log.startTime)
        return startTime.toLocaleDateString() + ' ' + startTime.toLocaleTimeString()
    }
    return ''
}

function getFullStatus(log) {
    if (!isNull(log.exitCode) && !isNull(log.status)) {
        return log.status + ' (' + log.exitCode + ')'
    } else if (!isNull(log.status)) {
        return log.status
    }
}
