<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Архив накладных</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
      <div class="flex flex-wrap gap-3 items-end">
        <div class="flex flex-col text-xs text-slate-300">
          <label class="mb-1">Номер</label>
          <input
            v-model="numberQuery"
            type="text"
            placeholder="Поиск по номеру"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div class="flex flex-col text-xs text-slate-300">
          <label class="mb-1">Дата с</label>
          <input
            v-model="fromDate"
            type="date"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div class="flex flex-col text-xs text-slate-300">
          <label class="mb-1">Дата по</label>
          <input
            v-model="toDate"
            type="date"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>
        <div class="flex flex-col text-xs text-slate-300">
          <label class="mb-1">Тип оплаты</label>
          <select
            v-model="paymentFilter"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="all">Все</option>
            <option value="cash">Наличные</option>
            <option value="cashless">Безналичные</option>
          </select>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60"
          :disabled="loading"
          @click="loadInvoices"
        >
          Обновить
        </button>
      </div>
      <div class="text-xs text-slate-400">
        Показано максимум 200 последних накладных по выбранному диапазону дат.
      </div>
    </div>

    <div v-if="error" class="text-sm text-red-400">
      {{ error }}
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-3 py-2 text-left">Дата</th>
            <th class="px-3 py-2 text-left">Номер</th>
            <th class="px-3 py-2 text-left">Контрагент</th>
            <th class="px-3 py-2 text-left">Тип оплаты</th>
            <th class="px-3 py-2 text-right">Сумма</th>
            <th class="px-3 py-2 text-right">Прибыль</th>
            <th class="px-3 py-2 text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in filteredInvoices" :key="inv._id" class="border-t border-slate-800">
            <td class="px-3 py-2">{{ formatDate(inv.date) }}</td>
            <td class="px-3 py-2">{{ inv.number || '—' }}</td>
            <td class="px-3 py-2">{{ inv.contractor || '—' }}</td>
            <td class="px-3 py-2">
              <span v-if="inv.paymentType === 'cash'">Наличные</span>
              <span v-else-if="inv.paymentType === 'cashless'">Безналичные</span>
              <span v-else>—</span>
            </td>
            <td class="px-3 py-2 text-right">{{ formatMoney(inv.totalAmount) }}</td>
            <td class="px-3 py-2 text-right">{{ formatMoney(inv.totalIncome) }}</td>
            <td class="px-3 py-2 text-right space-x-1">
              <button
                type="button"
                class="px-2 py-1 text-xs rounded border border-emerald-700 text-emerald-300 hover:bg-emerald-900 disabled:opacity-60"
                :disabled="loading"
                @click="restoreInvoice(inv._id)"
              >
                Восстановить
              </button>
              <button
                type="button"
                class="px-2 py-1 text-xs rounded border border-red-700 text-red-300 hover:bg-red-900 disabled:opacity-60"
                :disabled="loading"
                @click="deleteInvoice(inv._id)"
              >
                Удалить
              </button>
            </td>
          </tr>
          <tr v-if="!loading && filteredInvoices.length === 0">
            <td colspan="7" class="px-3 py-4 text-center text-slate-400">
              Накладные не найдены по выбранным условиям.
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="px-3 py-3 text-sm text-slate-400">
        Загрузка накладных...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import axios from 'axios';

interface InvoiceDto {
  _id: string;
  number?: string;
  date: string;
  contractor?: string;
  paymentType?: 'cash' | 'cashless';
  totalAmount?: number;
  totalIncome?: number;
}

const invoices = ref<InvoiceDto[]>([]);
const loading = ref(false);
const error = ref('');

const numberQuery = ref('');
const fromDate = ref('');
const toDate = ref('');
const paymentFilter = ref<'all' | 'cash' | 'cashless'>('all');

const deleteInvoice = async (id: string) => {
  if (!window.confirm('Удалить эту накладную? Это действие нельзя отменить.')) return;

  try {
    await axios.delete(`/api/v1/invoices/${id}`);
    // Локально убираем удалённую накладную без повторной загрузки всего списка
    invoices.value = invoices.value.filter((inv) => inv._id !== id);
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка при удалении накладной';
  }
};

const restoreInvoice = async (id: string) => {
  if (loading.value) return;
  try {
    await axios.post(`/api/v1/invoices/${id}/restore`);
    // После восстановления накладная больше не должна быть в архиве
    invoices.value = invoices.value.filter((inv) => inv._id !== id);
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка при восстановлении накладной';
  }
};

const loadInvoices = async () => {
  loading.value = true;
  error.value = '';

  try {
    const params: Record<string, string> = {};
    if (fromDate.value) params.from = fromDate.value;
    if (toDate.value) params.to = toDate.value;

    const res = await axios.get('/api/v1/invoices/archived', { params });
    invoices.value = res.data.invoices || [];
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки накладных';
  } finally {
    loading.value = false;
  }
};

const filteredInvoices = computed(() => {
  const numQ = numberQuery.value.trim().toLowerCase();
  const pay = paymentFilter.value;

  return invoices.value.filter((inv) => {
    const numOk = !numQ || (inv.number || '').toLowerCase().includes(numQ);
    const payOk =
      pay === 'all' || (pay === 'cash' && inv.paymentType === 'cash') || (pay === 'cashless' && inv.paymentType === 'cashless');
    return numOk && payOk;
  });
});

const formatDate = (d: string | Date) => {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU');
};

const formatMoney = (v?: number) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(v);
};

onMounted(() => {
  // по умолчанию показываем накладные за последние 30 дней
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  fromDate.value = from;
  toDate.value = to;
  loadInvoices();
});
</script>

<style scoped></style>
