import { defineStore } from 'pinia';
import axios from 'axios';

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
    async login(email: string, password: string) {
      const res = await axios.post('/api/v1/auth/login', { email, password });
      this.accessToken = res.data.accessToken;
      this.user = res.data.user;
      localStorage.setItem('accessToken', this.accessToken!);
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
    },
    logout() {
      this.user = null;
      this.accessToken = null;
      localStorage.removeItem('accessToken');
      delete axios.defaults.headers.common['Authorization'];
    },
    async fetchMe() {
      if (!this.accessToken) return;
      axios.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
      const res = await axios.get('/api/v1/auth/me');
      this.user = res.data.user;
    },
  },
});
