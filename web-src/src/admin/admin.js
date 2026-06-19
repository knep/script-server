import 'material-design-icons/iconfont/material-icons.css';
import 'typeface-roboto';
import '@/assets/css/shared.css';
import {createApp} from 'vue';
import {createPinia} from 'pinia';
import AdminApp from './AdminApp';
import router from './router/router';
import vueDirectives from '@/common/vueDirectives'
import vuetify from '@/common/vuetifyPlugin'
import {initTheme, registerVuetifyTheme} from '@/common/utils/theme'
import {forEachKeyValue} from '@/common/utils/common'

const pinia = createPinia()
const app = createApp(AdminApp)

forEachKeyValue(vueDirectives, (id, definition) => {
    app.directive(id, definition)
})

app.use(pinia).use(router).use(vuetify)

registerVuetifyTheme(vuetify.theme.global)
initTheme()

app.mount('#admin-page')
