<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Пользователи и права</h1>
    </div>

    <div v-if="loading" class="text-xs text-slate-400">Загрузка пользователей...</div>
    <div v-if="error" class="text-xs text-red-400">{{ error }}</div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 space-y-2">
      <div class="text-xs uppercase text-slate-400">Добавить пользователя</div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          v-model="newUser.fullName"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="ФИО"
        />
        <input
          v-model="newUser.email"
          type="email"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Email"
        />
        <input
          v-model="newUser.password"
          type="password"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Пароль"
        />
        <select
          v-model="newUser.role"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
        >
          <option value="manager">Менеджер</option>
          <option value="admin">Админ</option>
        </select>
      </div>
      <div class="flex items-center justify-between mt-1">
        <button
          type="button"
          class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="createLoading || !newUser.fullName || !newUser.email || !newUser.password"
          @click="createUser"
        >
          {{ createLoading ? 'Создание...' : 'Создать' }}
        </button>
        <div class="text-right text-[11px]">
          <div v-if="createError" class="text-red-400">{{ createError }}</div>
          <div v-if="createSuccess" class="text-emerald-400">Пользователь создан</div>
        </div>
      </div>
    </div>

    <div v-if="!loading" class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200">
      <table class="min-w-full text-[11px]">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-2 py-1 text-left">Имя</th>
            <th class="px-2 py-1 text-left">Email</th>
            <th class="px-2 py-1 text-left">Роль</th>
            <th class="px-2 py-1 text-center">Активен</th>
            <th class="px-2 py-1 text-left">Права доступа</th>
            <th class="px-2 py-1 text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user._id" class="border-t border-slate-800 align-top">
            <td class="px-2 py-1">
              <input
                v-model="editState[user._id].fullName"
                type="text"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-full"
                :disabled="isSelf(user)"
              />
            </td>
            <td class="px-2 py-1">
              <input
                v-model="editState[user._id].email"
                type="email"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-full"
                :disabled="isSelf(user)"
              />
            </td>
            <td class="px-2 py-1">
              <select
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                :value="user.role"
                @change="onChangeRole(user, $event)"
                :disabled="isSelf(user)"
              >
                <option value="manager">Менеджер</option>
                <option value="admin">Админ</option>
              </select>
            </td>
            <td class="px-2 py-1 text-center">
              <input
                type="checkbox"
                :checked="user.isActive"
                @change="onToggleActive(user, $event)"
                :disabled="isSelf(user)"
              />
            </td>
            <td class="px-2 py-1">
              <div class="flex flex-wrap gap-2">
                <label v-for="perm in permissionKeys" :key="perm.key" class="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    :checked="!!(user.permissions && user.permissions[perm.key])"
                    @change="onTogglePermission(user, perm.key, $event)"
                  />
                  <span>{{ perm.label }}</span>
                </label>
              </div>
            </td>
            <td class="px-2 py-1 text-right">
              <button
                type="button"
                class="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed mr-2"
                :disabled="isSelf(user) || saveLoadingId === user._id || !isDirty(user)"
                @click="saveUser(user)"
              >
                {{ saveLoadingId === user._id ? 'Сохранение...' : 'Сохранить' }}
              </button>
              <button
                type="button"
                class="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="isSelf(user) || deleteLoadingId === user._id"
                @click="deleteUser(user)"
              >
                {{ deleteLoadingId === user._id ? 'Удаление...' : 'Удалить' }}
              </button>
            </td>
          </tr>
          <tr v-if="!users.length && !loading">
            <td colspan="6" class="px-2 py-3 text-center text-slate-400">Пользователи не найдены</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useAuthStore } from '../../store/auth';

interface UserWithPermissions {
  _id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager';
  isActive: boolean;
  permissions?: Record<string, boolean>;
}

const users = ref<UserWithPermissions[]>([]);
const loading = ref(false);
const error = ref('');

const auth = useAuthStore();

const newUser = ref({ fullName: '', email: '', password: '', role: 'manager' as 'admin' | 'manager' });
const createLoading = ref(false);
const createError = ref('');
const createSuccess = ref(false);

const deleteLoadingId = ref<string>('');
const saveLoadingId = ref<string>('');
const editState = ref<Record<string, { fullName: string; email: string }>>({});

const permissionKeys = [
  { key: 'invoices', label: 'Накладные' },
  { key: 'warehouse', label: 'Общая база товаров' },
  { key: 'stock', label: 'Наш склад' },
  { key: 'counterparties', label: 'Контрагенты' },
  { key: 'cars', label: 'Автопарк' },
  { key: 'drivers', label: 'Водители' },
  { key: 'finance', label: 'Финансы' },
  { key: 'salaries', label: 'Зарплаты' },
  { key: 'reports', label: 'Раздел Отчёты' },
  { key: 'reportsWarehouseProfit', label: 'Отчёт: Прибыль склада' },
  { key: 'reportsInvoices', label: 'Отчёт: Накладные' },
  { key: 'reportsContractorDebts', label: 'Отчёт: Долги контрагентов' },
];

const loadUsers = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/v1/auth/users');
    users.value = (res.data?.users || []) as UserWithPermissions[];

    const nextState: Record<string, { fullName: string; email: string }> = {};
    for (const u of users.value) {
      nextState[u._id] = { fullName: u.fullName, email: u.email };
    }
    editState.value = nextState;
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки пользователей';
  } finally {
    loading.value = false;
  }
};

const saveUser = async (user: UserWithPermissions) => {
  if (isSelf(user)) return;
  const st = editState.value[user._id];
  if (!st) return;

  if (!st.fullName || !st.email) {
    error.value = 'ФИО и email обязательны';
    return;
  }
  if (!isDirty(user)) return;

  saveLoadingId.value = user._id;
  try {
    const res = await axios.put(`/api/v1/auth/users/${user._id}`, {
      fullName: st.fullName,
      email: st.email,
    });
    const updated = res.data?.user as UserWithPermissions | undefined;
    if (updated) {
      user.fullName = updated.fullName;
      user.email = updated.email;
      editState.value[user._id] = { fullName: updated.fullName, email: updated.email };
    } else {
      user.fullName = st.fullName;
      user.email = st.email;
    }
  } catch (e: any) {
    editState.value[user._id] = { fullName: user.fullName, email: user.email };
    error.value = e?.response?.data?.message || 'Ошибка сохранения пользователя';
  } finally {
    saveLoadingId.value = '';
  }
};

const isSelf = (user: UserWithPermissions): boolean => {
  return !!auth.user?.id && auth.user.id === user._id;
};

const isDirty = (user: UserWithPermissions): boolean => {
  const st = editState.value[user._id];
  if (!st) return false;
  return st.fullName !== user.fullName || st.email !== user.email;
};

const createUser = async () => {
  if (!newUser.value.fullName || !newUser.value.email || !newUser.value.password) return;
  createLoading.value = true;
  createError.value = '';
  createSuccess.value = false;

  try {
    await axios.post('/api/v1/auth/users', {
      fullName: newUser.value.fullName,
      email: newUser.value.email,
      password: newUser.value.password,
      role: newUser.value.role,
    });

    createSuccess.value = true;
    newUser.value = { fullName: '', email: '', password: '', role: 'manager' };
    await loadUsers();
  } catch (e: any) {
    createError.value = e?.response?.data?.message || 'Ошибка создания пользователя';
  } finally {
    createLoading.value = false;
  }
};

const onChangeRole = async (user: UserWithPermissions, event: Event) => {
  if (isSelf(user)) return;
  const target = event.target as HTMLSelectElement;
  const nextRole = target.value as 'admin' | 'manager';

  const prevRole = user.role;
  user.role = nextRole;
  try {
    await axios.put(`/api/v1/auth/users/${user._id}`, { role: nextRole });
  } catch (e: any) {
    user.role = prevRole;
    error.value = e?.response?.data?.message || 'Ошибка обновления роли пользователя';
  }
};

const onToggleActive = async (user: UserWithPermissions, event: Event) => {
  if (isSelf(user)) return;
  const target = event.target as HTMLInputElement;
  const nextActive = !!target.checked;

  const prev = user.isActive;
  user.isActive = nextActive;
  try {
    await axios.put(`/api/v1/auth/users/${user._id}`, { isActive: nextActive });
  } catch (e: any) {
    user.isActive = prev;
    target.checked = prev;
    error.value = e?.response?.data?.message || 'Ошибка обновления статуса пользователя';
  }
};

const deleteUser = async (user: UserWithPermissions) => {
  if (isSelf(user)) return;
  const ok = window.confirm(`Удалить пользователя ${user.fullName} (${user.email})?`);
  if (!ok) return;

  deleteLoadingId.value = user._id;
  try {
    await axios.delete(`/api/v1/auth/users/${user._id}`);
    await loadUsers();
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка удаления пользователя';
  } finally {
    deleteLoadingId.value = '';
  }
};

const onTogglePermission = async (user: UserWithPermissions, key: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  const checked = target.checked;

  const current = { ...(user.permissions || {}) };
  current[key] = checked;

  try {
    await axios.put(`/api/v1/auth/users/${user._id}/permissions`, { permissions: current });
    user.permissions = current;
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка сохранения прав пользователя';
  }
};

onMounted(() => {
  loadUsers();
});
</script>
