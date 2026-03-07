import { defineStore } from 'pinia';
import axios from 'axios';
import { updateSocketAuth } from '../realtime/socket';
import { initPush } from '../realtime/usePush';

interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager';
  permissions?: Record<string, boolean>;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
}

let refreshTimer: number | null = null;

const getJwtExpMs = (token: string): number | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    const expSec = Number(payload?.exp);
    if (!Number.isFinite(expSec) || expSec <= 0) return null;
    return expSec * 1000;
  } catch {
    return null;
  }
};

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    accessToken: localStorage.getItem('accessToken'),
  }),
  getters: {
    isAuthenticated: (state) => !!state.accessToken,
  },
  actions: {
    setAccessToken(token: string | null) {
      this.accessToken = token;

      if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
      }

      if (token) {
        localStorage.setItem('accessToken', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        updateSocketAuth(token);

        const expMs = getJwtExpMs(token);
        if (expMs) {
          const delay = Math.max(5_000, expMs - Date.now() - 60_000);
          const self = this;
          refreshTimer = window.setTimeout(() => {
            self.refresh().catch(() => {});
          }, delay);
        }
      } else {
        localStorage.removeItem('accessToken');
        delete axios.defaults.headers.common['Authorization'];
        updateSocketAuth(null);
      }
    },
    async login(email: string, password: string) {
      const res = await axios.post('/api/v1/auth/login', { email, password });
      this.setAccessToken(res.data.accessToken);
      this.user = res.data.user;
      initPush().catch(() => {});
    },
    logout() {
      this.user = null;
      this.setAccessToken(null);
    },
    async refresh() {
      // Uses httpOnly cookie refreshToken
      const res = await axios.post('/api/v1/auth/refresh');
      this.user = res.data.user;
      this.setAccessToken(res.data.accessToken);
    },
    async fetchMe() {
      if (!this.accessToken) return;
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      const res = await axios.get('/api/v1/auth/me');
      this.user = res.data.user;
    },
  },
});
