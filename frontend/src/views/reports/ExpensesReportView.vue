<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Отчёт по операционным расходам</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1 text-[11px] flex-1 min-w-[260px]">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1">
              <span class="text-slate-400">Период:</span>
              <input
                v-model="from"
                type="date"
                class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
              />
              <span class="text-slate-400">—</span>
              <input
                v-model="to"
                type="date"
                class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
              />
            </div>
            <button
              type="button"
              class="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white disabled:opacity-60"
              :disabled="loading"
              @click="reloadAll"
            >
              {{ loading ? 'Загрузка...' : 'Показать' }}
            </button>
          </div>
          <div class="flex items-center gap-1 flex-wrap">
            <span class="text-slate-400">Быстрый период:</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('month')"
            >
              Месяц
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('year')"
            >
              Год
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('prevYear')"
            >
              Прошлый год
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
              @click="clearPreset"
            >
              Сброс
            </button>
          </div>
        </div>
        <div class="text-[11px] text-slate-400">
          Показывает суммы операционных расходов по категориям за выбранный период.
        </div>
      </div>

      <div v-if="error" class="text-xs text-red-400">{{ error }}</div>

      <div v-if="summary" class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] mt-2">
        <div>
          <div class="text-slate-400">Всего расходов</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalAmount) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Количество записей</div>
          <div class="text-slate-100 text-sm font-semibold">
            {{ summary.totalCount }}
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200">
        <div class="text-[11px] text-slate-400 mb-2">Категории расходов</div>
        <div class="overflow-x-auto">
          <table class="min-w-full text-[11px]">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-1 text-left">Категория</th>
                <th class="px-2 py-1 text-right">Записей</th>
                <th class="px-2 py-1 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.category"
                class="border-t border-slate-800 cursor-pointer hover:bg-slate-800/60"
                @click="selectCategory(row)"
              >
                <td class="px-2 py-1">{{ humanCategory(row.category) }}</td>
                <td class="px-2 py-1 text-right">{{ row.count }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(row.total) }}</td>
              </tr>
              <tr v-if="!loading && rows.length === 0">
                <td colspan="3" class="px-2 py-3 text-center text-slate-400">Нет данных за выбранный период.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <div class="font-semibold text-sm">Расходы по категории</div>
          <div class="text-[11px] text-slate-400" v-if="selectedCategory">
            {{ humanCategory(selectedCategory) }}
          </div>
        </div>
        <div v-if="detailsLoading" class="text-[11px] text-slate-400">Загрузка записей...</div>
        <div v-if="detailsError" class="text-[11px] text-red-400">{{ detailsError }}</div>
        <div class="border border-slate-800 rounded-lg max-h-80 overflow-auto">
          <table class="min-w-full text-[11px]">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-1 text-left">Дата</th>
                <th class="px-2 py-1 text-left">Комментарий</th>
                <th class="px-2 py-1 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="exp in details"
                :key="exp._id"
                class="border-t border-slate-800"
              >
                <td class="px-2 py-1">{{ new Date(exp.date).toLocaleDateString('ru-RU') }}</td>
                <td class="px-2 py-1 truncate max-w-[220px]" :title="exp.description || ''">
                  {{ exp.description || '' }}
                </td>
                <td class="px-2 py-1 text-right">{{ formatMoney(exp.amount) }}</td>
              </tr>
              <tr v-if="!detailsLoading && details.length === 0">
                <td colspan="3" class="px-2 py-3 text-center text-slate-400">Выберите категорию слева.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

interface ExpenseCategoryRow {
  category: string;
  total: number;
  count: number;
}

interface ExpenseSummary {
  totalAmount: number;
  totalCount: number;
}

interface ExpenseDetailRow {
  _id: string;
  date: string;
  amount: number;
  category: string;
  description?: string | null;
}

const from = ref('');
const to = ref('');

const rows = ref<ExpenseCategoryRow[]>([]);
const summary = ref<ExpenseSummary | null>(null);
const loading = ref(false);
const error = ref('');

const selectedCategory = ref<string | null>(null);
const details = ref<ExpenseDetailRow[]>([]);
const detailsLoading = ref(false);
const detailsError = ref('');

const formatMoney = (value: number) => {
  return (Number(value) || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const loadReport = async () => {
  loading.value = true;
  error.value = '';
  try {
    const params: any = {};
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;
    const res = await axios.get('/api/v1/finance/operating-expenses/report', { params });
    rows.value = (res.data?.rows || []) as ExpenseCategoryRow[];
    summary.value = (res.data?.summary || null) as ExpenseSummary | null;
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки отчёта по расходам';
  } finally {
    loading.value = false;
  }
};

const loadDetails = async () => {
  if (!selectedCategory.value) {
    details.value = [];
    return;
  }

  detailsLoading.value = true;
  detailsError.value = '';
  try {
    const params: any = { category: selectedCategory.value };
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;
    const res = await axios.get('/api/v1/finance/operating-expenses', { params });
    details.value = (res.data?.expenses || []) as ExpenseDetailRow[];
  } catch (e: any) {
    detailsError.value = e?.response?.data?.message || 'Ошибка загрузки записей по категории';
  } finally {
    detailsLoading.value = false;
  }
};

const reloadAll = async () => {
  await loadReport();
  await loadDetails();
};

type Preset = 'month' | 'year' | 'prevYear';

const formatDateInput = (d: Date) => d.toISOString().slice(0, 10);

const setPreset = (p: Preset) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (p === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (p === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (p === 'prevYear') {
    const y = now.getFullYear() - 1;
    start = new Date(y, 0, 1);
    end = new Date(y, 11, 31);
  }

  from.value = formatDateInput(start);
  to.value = formatDateInput(end);
  reloadAll();
};

const clearPreset = () => {
  from.value = '';
  to.value = '';
  reloadAll();
};

const selectCategory = (row: ExpenseCategoryRow) => {
  selectedCategory.value = row.category;
  loadDetails();
};

const humanCategory = (code: string) => {
  switch (code) {
    case 'rent':
      return 'Аренда';
    case 'salary':
      return 'Зарплаты';
    case 'fuel':
      return 'Топливо';
    case 'carService':
      return 'Авто (ремонт/сервис)';
    case 'utilities':
      return 'Коммунальные / связь';
    case 'marketing':
      return 'Маркетинг';
    case 'taxes':
      return 'Налоги/взносы';
    default:
      return 'Другое';
  }
};

// начальная загрузка
loadReport();
</script>

<style scoped></style>
