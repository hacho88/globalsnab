import { createApp } from 'vue';
import { createPinia } from 'pinia';
import axios from 'axios';
import App from './App.vue';
import { router } from './router';
import './assets/tailwind.css';
import { useAuthStore } from './store/auth';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

// Восстанавливаем токен из localStorage и настраиваем axios
const auth = useAuthStore();
if (auth.accessToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${auth.accessToken}`;
}

app.use(router);
app.mount('#app');
