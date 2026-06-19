import 'material-design-icons/iconfont/material-icons.css';
import 'typeface-roboto';
import '@/assets/css/shared.css';
import {isNull} from '@/common/utils/common';
import {axiosInstance} from '@/common/utils/axios_utils';
import get from 'lodash/get';
import {createApp, watch} from 'vue'
import {createPinia} from 'pinia'
import MainApp from './MainApp.vue';
import router from './router/router'
import vueDirectives from '@/common/vueDirectives'
import vuetify from '@/common/vuetifyPlugin'
import {initTheme, registerVuetifyTheme} from '@/common/utils/theme'
import {forEachKeyValue} from '@/common/utils/common';
import {useAuthStore} from '@/common/stores/auth';
import {useScriptsStore} from '@/main-app/stores/scripts';
import {useScriptConfigStore} from '@/main-app/stores/scriptConfig';
import {useScriptSetupStore} from '@/main-app/stores/scriptSetup';
import {useExecutionsStore} from '@/main-app/stores/executions';
import {useScriptTabsStore} from '@/main-app/stores/scriptTabs';

const pinia = createPinia()
const app = createApp(MainApp)

forEachKeyValue(vueDirectives, (id, definition) => {
    app.directive(id, definition)
})

app.use(pinia)
app.use(router)
app.use(vuetify)

registerVuetifyTheme(vuetify.theme.global)
initTheme()

const scriptsStore = useScriptsStore()
const scriptConfigStore = useScriptConfigStore()
const scriptSetupStore = useScriptSetupStore()

watch(() => scriptsStore.selectedScript, (selectedScript, previousScript) => {
    const tabsStore = useScriptTabsStore()

    // Snapshot the form values of the tab we're leaving so they can be restored
    // when the user comes back to it.
    if (!isNull(previousScript)) {
        tabsStore.saveValues(previousScript, scriptSetupStore.parameterValues)
    }
    if (!isNull(selectedScript)) {
        tabsStore.openTab(selectedScript)
    }

    scriptSetupStore.reset()
    useScriptConfigStore().reloadScript(selectedScript)
    useExecutionsStore().selectScript({selectedScript})
})

watch(() => scriptsStore.predefinedParameters, (predefinedParameters) => {
    if (!isNull(predefinedParameters)) {
        scriptSetupStore.reloadModel({
            values: predefinedParameters,
            forceAllowedValues: false,
            scriptName: scriptsStore.selectedScript
        })
    }
})

watch(() => scriptConfigStore.parameters, (parameters) => {
    const scriptConfig = scriptConfigStore.scriptConfig
    const scriptName = scriptConfig ? scriptConfig.name : null
    scriptSetupStore.initFromParameters({scriptName, parameters, scriptConfig})

    // Restore the previously-entered values for this tab, once. consumeValues
    // deletes them so the parameter echo from reloadModel doesn't loop here.
    if (!isNull(scriptName)) {
        const savedValues = useScriptTabsStore().consumeValues(scriptName)
        if (savedValues && Object.keys(savedValues).length > 0) {
            scriptSetupStore.reloadModel({values: savedValues, forceAllowedValues: false, scriptName})
        }
    }
})

axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        if (get(error, 'response.status') === 401) {
            useAuthStore().setAuthenticated(false)
        }
        throw error
    }
)

app.mount('#app')
