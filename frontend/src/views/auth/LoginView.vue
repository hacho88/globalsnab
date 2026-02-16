<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900 px-4">
    <div class="w-full max-w-md bg-slate-950 border border-slate-800 rounded-xl p-6 shadow-xl">
      <h1 class="text-2xl font-bold mb-6 text-center">GlobalSnab ERP</h1>
      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="block text-sm mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            required
            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div>
          <label class="block text-sm mb-1">Пароль</label>
          <input
            v-model="password"
            type="password"
            required
            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <div v-if="error" class="text-sm text-red-400">
          {{ error }}
        </div>
        <button
          type="submit"
          class="w-full py-2 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold disabled:opacity-60"
          :disabled="loading"
        >
          <span v-if="!loading">Войти</span>
          <span v-else>Входим...</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../store/auth';

const email = ref('admin@globalsnab.local');
const password = ref('Admin123!');
const loading = ref(false);
const error = ref('');

const auth = useAuthStore();
const router = useRouter();

const onSubmit = async () => {
  loading.value = true;
  error.value = '';
  try {
    await auth.login(email.value, password.value);
    await auth.fetchMe();
    router.push({ name: 'dashboard' });
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка входа';
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped></style>
