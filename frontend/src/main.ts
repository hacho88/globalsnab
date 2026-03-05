import { createApp } from 'vue';
import { createPinia } from 'pinia';
import axios from 'axios';
import App from './App.vue';
import { router } from './router';
import './assets/tailwind.css';
import { useAuthStore } from './store/auth';
import { initPush } from './realtime/usePush';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);

axios.defaults.withCredentials = true;

// Восстанавливаем токен из localStorage и настраиваем axios
const auth = useAuthStore();
if (auth.accessToken) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${auth.accessToken}`;
  initPush().catch(() => {});
}

// Silent refresh on 401 (once)
axios.interceptors.response.use(
  (r) => r,
  async (err) => {
    const status = err?.response?.status;
    const cfg = err?.config;
    if (status === 401 && cfg && !cfg.__retried) {
      cfg.__retried = true;
      try {
        await auth.refresh();
        cfg.headers = cfg.headers || {};
        if (auth.accessToken) cfg.headers['Authorization'] = `Bearer ${auth.accessToken}`;
        return axios(cfg);
      } catch {
        auth.logout();
      }
    }
    return Promise.reject(err);
  }
);

app.use(router);
app.mount('#app');
