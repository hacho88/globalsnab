<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Отчёт по накладным</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-sm text-slate-200">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Дата с</label>
          <input
            v-model="from"
            type="date"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Дата по</label>
          <input
            v-model="to"
            type="date"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Клиент (покупатель)</label>
          <input
            v-model="client"
            type="text"
            placeholder="Например: ООО ЭКОПЛАНТТ"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm placeholder-slate-500"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Группировка</label>
          <select
            v-model="groupBy"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
          >
            <option value="day">По дням</option>
            <option value="month">По месяцам</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap mt-2">
        <button
          type="button"
          class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-60"
          :disabled="loading"
          @click="loadReport"
        >
          {{ loading ? 'Загружаем отчёт...' : 'Показать отчёт' }}
        </button>
        <button
          type="button"
          class="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-60"
          :disabled="loading || rows.length === 0"
          @click="exportCsv"
        >
          Экспорт в Excel (CSV)
        </button>
        <div v-if="error" class="text-xs text-red-400">
          {{ error }}
        </div>
      </div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 space-y-3">
      <div class="flex items-center justify-between text-xs text-slate-300">
        <div>
          <span class="font-semibold">Результат</span>
        </div>
        <div v-if="summary">
          <div>
            Всего продаж: {{ formatMoney(summary.totalSales) }}
          </div>
          <div>
            Всего доход: {{ formatMoney(summary.totalIncome) }}
          </div>
          <div>
            Количество накладных: {{ summary.count || 0 }}
          </div>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Период</th>
              <th class="px-2 py-1 text-right">Сумма продаж</th>
              <th class="px-2 py-1 text-right">Доход</th>
              <th class="px-2 py-1 text-right">Кол-во накладных</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.period" class="border-t border-slate-800">
              <td class="px-2 py-1">{{ row.period }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.totalSales) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.totalIncome) }}</td>
              <td class="px-2 py-1 text-right">{{ row.count }}</td>
            </tr>
            <tr v-if="!loading && rows.length === 0">
              <td colspan="4" class="px-2 py-3 text-center text-slate-400">
                Отчёт пока пуст. Выберите период и нажмите "Показать отчёт".
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

interface ReportRow {
  period: string;
  totalSales: number;
  totalIncome: number;
  count: number;
}

interface ReportSummary {
  totalSales: number;
  totalIncome: number;
  count: number;
}

const from = ref<string>('');
const to = ref<string>('');
const client = ref<string>('');
const groupBy = ref<'day' | 'month'>('day');

const rows = ref<ReportRow[]>([]);
const summary = ref<ReportSummary | null>(null);
const loading = ref(false);
const error = ref('');

const buildQuery = () => {
  const params: Record<string, string> = {};
  if (from.value) params.from = from.value;
  if (to.value) params.to = to.value;
  if (client.value.trim()) params.client = client.value.trim();
  if (groupBy.value) params.groupBy = groupBy.value;
  const search = new URLSearchParams(params).toString();
  return search ? `?${search}` : '';
};

const loadReport = async () => {
  loading.value = true;
  error.value = '';
  try {
    const query = buildQuery();
    const res = await axios.get(`/api/v1/invoices/report${query}`);
    rows.value = res.data?.rows || [];
    summary.value = res.data?.summary || { totalSales: 0, totalIncome: 0, count: 0 };
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки отчёта по накладным';
  } finally {
    loading.value = false;
  }
};

const formatMoney = (v: number | null | undefined) => {
  const num = Number(v);
  if (!Number.isFinite(num)) return '0,00 ₽';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(num);
};

const exportCsv = () => {
  if (!rows.value.length) return;

  const header = ['period', 'totalSales', 'totalIncome', 'count'];
  const dataRows = rows.value.map((r) => [
    r.period,
    String(r.totalSales ?? ''),
    String(r.totalIncome ?? ''),
    String(r.count ?? ''),
  ]);

  const escape = (value: unknown) => {
    const s = String(value ?? '');
    if (s.includes('"') || s.includes(';') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csvLines = [header, ...dataRows].map((row) => row.map(escape).join(';'));
  const csvContent = '\uFEFF' + csvLines.join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `invoices-report-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
</script>

<style scoped></style>
