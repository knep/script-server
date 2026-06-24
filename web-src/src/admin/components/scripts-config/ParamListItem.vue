<template>
  <v-expansion-panel :value="panelValue" class="param-list-item">
    <v-expansion-panel-title hide-actions class="param-header">
      <div class="param-title">
        <v-icon :color="errorText ? 'error' : undefined" :title="errorText" size="small">
          {{ errorText ? 'warning' : 'unfold_more' }}
        </v-icon>
        <span :class="{'text-error': errorText}" class="param-name ml-2">{{ param.name }}</span>
      </div>
    </v-expansion-panel-title>
    <div class="param-actions">
      <v-btn icon="delete" variant="text" density="compact" @click="$emit('delete')"/>
      <v-btn icon="arrow_upward" variant="text" density="compact" @click="$emit('moveUp')"/>
      <v-btn icon="arrow_downward" variant="text" density="compact" @click="$emit('moveDown')"/>
    </div>
    <v-expansion-panel-text>
      <ParameterConfigForm :modelValue="param" @error="handleError($event)"/>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script>
import {forEachKeyValue, isEmptyObject, isEmptyString, isNull} from '@/common/utils/common';
import ParameterConfigForm from './ParameterConfigForm';

export default {
  name: 'ParamListItem',
  components: {ParameterConfigForm},

  props: {
    param: {
      type: Object
    },
    panelValue: {
      type: String
    }
  },

  emits: ['delete', 'moveUp', 'moveDown'],

  data() {
    return {
      errors: null
    }
  },

  computed: {
    errorText() {
      const errors = this.errors;
      if (isEmptyObject(errors)) {
        return null;
      }

      let text = '';
      forEachKeyValue(errors, (key, value) => text += key + ': ' + value + '\n');
      return text;
    }
  },

  methods: {
    handleError(error) {
      if (isNull(this.errors)) {
        this.errors = {};
      }

      const fieldName = error['fieldName'];
      if (isEmptyString(error.message)) {
        delete this.errors[fieldName];
      } else {
        this.errors[fieldName] = error.message;
      }
    }
  }
}
</script>

<style scoped>
.param-list-item {
  position: relative;
}

/* Reserve room on the right for the absolutely-positioned action buttons so the
   parameter name can't slide under them. */
.param-header {
  padding-right: 130px;
}

/* Keep the icon + name together on the left (the title defaults to
   justify-content: space-between, which otherwise pushes the name to the far
   right, on top of the action buttons). */
.param-title {
  display: flex;
  align-items: center;
  min-width: 0;
}

.param-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.param-actions {
  position: absolute;
  right: 8px;
  top: 0;
  height: 48px;
  display: flex;
  align-items: center;
  z-index: 1;
}
</style>
