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
      if (token) {
        localStorage.setItem('accessToken', token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        updateSocketAuth(token);
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
