<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Прибыль Нашего склада</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
      <div class="flex flex-wrap gap-3 items-end">
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
          <label class="mb-1">Группировка</label>
          <select
            v-model="groupBy"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="day">По дням</option>
            <option value="week">По неделям</option>
            <option value="month">По месяцам</option>
            <option value="year">По годам</option>
          </select>
        </div>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-60"
          :disabled="loading"
          @click="loadReport"
        >
          Обновить
        </button>
      </div>
      <div class="text-xs text-slate-400">
        Отчёт считает только строки накладных с контрагентом "НАШ СКЛАД".
      </div>
    </div>

    <div v-if="error" class="text-sm text-red-400">
      {{ error }}
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-3 py-2 text-left">Период</th>
            <th class="px-3 py-2 text-right">Выручка</th>
            <th class="px-3 py-2 text-right">Прибыль</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.key" class="border-t border-slate-800">
            <td class="px-3 py-2">{{ row.label }}</td>
            <td class="px-3 py-2 text-right">{{ formatMoney(row.totalAmount) }}</td>
            <td class="px-3 py-2 text-right">{{ formatMoney(row.totalIncome) }}</td>
          </tr>
          <tr v-if="!loading && rows.length === 0">
            <td colspan="3" class="px-3 py-4 text-center text-slate-400">
              Данных по выбранному периоду нет.
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="px-3 py-3 text-sm text-slate-400">
        Загрузка отчёта...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import axios from 'axios';

interface RowDto {
  key: string;
  label: string;
  totalAmount: number;
  totalIncome: number;
}

const fromDate = ref('');
const toDate = ref('');
const groupBy = ref<'day' | 'week' | 'month' | 'year'>('day');

const rows = ref<RowDto[]>([]);
const loading = ref(false);
const error = ref('');

const loadReport = async () => {
  loading.value = true;
  error.value = '';
  rows.value = [];

  try {
    const params: Record<string, string> = { groupBy: groupBy.value };
    if (fromDate.value) params.from = fromDate.value;
    if (toDate.value) params.to = toDate.value;

    const res = await axios.get('/api/v1/reports/warehouse-profit', { params });
    const gb = res.data.groupBy as 'day' | 'week' | 'month' | 'year';
    const data = res.data.rows || [];

    rows.value = data.map((r: any) => {
      const id = r._id || {};
      let label = '';
      if (gb === 'day') {
        label = `${id.year ?? ''}-${String(id.month ?? '').padStart(2, '0')}-${String(id.day ?? '').padStart(2, '0')}`;
      } else if (gb === 'week') {
        label = `Неделя ${id.week ?? ''} ${id.year ?? ''}`;
      } else if (gb === 'month') {
        label = `${id.year ?? ''}-${String(id.month ?? '').padStart(2, '0')}`;
      } else if (gb === 'year') {
        label = String(id.year ?? '');
      }

      return {
        key: JSON.stringify(id),
        label,
        totalAmount: r.totalAmount ?? 0,
        totalIncome: r.totalIncome ?? 0,
      } as RowDto;
    });
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки отчёта';
  } finally {
    loading.value = false;
  }
};

const formatMoney = (v: number) => {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(v);
};

onMounted(() => {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  fromDate.value = from;
  toDate.value = to;
  loadReport();
});
</script>

<style scoped></style>
