<template>

</template>

<script>
import {forEachKeyValue} from '@/common/utils/common';
import {setDefaultFavicon, setExecutingFavicon} from './favicon_manager';
import {useExecutionsStore} from '@/main-app/stores/executions';

export default {
  name: 'FaviconManager',
  mounted() {
    setDefaultFavicon();
  },
  computed: {
    hasExecuting() {
      const executors = useExecutionsStore().executors;

      let hasExecuting = false;

      forEachKeyValue(executors, function (id, executor) {
        if (executor.state.status === 'executing') {
          hasExecuting = true;
        }
      });

      return hasExecuting;
    }
  },
  watch: {
    hasExecuting(newValue) {
      if (newValue) {
        setExecutingFavicon();
      } else {
        setDefaultFavicon();
      }
    }
  }
}
</script>

<style scoped>

</style>