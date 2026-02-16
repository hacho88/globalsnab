<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold">Долги по контрагентам</h1>
        <div class="text-[11px] text-slate-400">Выберите контрагента, отметьте строки как оплаченные, контролируйте суммы.</div>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs disabled:opacity-60"
        :disabled="loadingSummary"
        @click="loadSummary"
      >
        {{ loadingSummary ? 'Обновляем...' : 'Обновить сводку' }}
      </button>
    </div>

    <div v-if="summaryError" class="text-xs text-red-400">{{ summaryError }}</div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
        <div class="text-[11px] text-slate-400">Контрагентов</div>
        <div class="text-lg font-semibold text-slate-100">{{ summaryFiltered.length }}</div>
      </div>
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
        <div class="text-[11px] text-slate-400">Долг всего</div>
        <div class="text-lg font-semibold text-amber-300">{{ formatMoney(totalDebtAll) }} ₽</div>
      </div>
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
        <div class="text-[11px] text-slate-400">Выбрано строк</div>
        <div class="text-lg font-semibold text-slate-100">{{ selectedItemIds.length }}</div>
      </div>
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
        <div class="text-[11px] text-slate-400">Сумма выбранного</div>
        <div class="text-lg font-semibold" :class="selectedAmount > 0 ? 'text-emerald-400' : 'text-slate-100'">
          {{ formatMoney(selectedAmount) }} ₽
        </div>
      </div>
    </div>

    <div class="grid lg:grid-cols-2 gap-4">
      <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200">
        <div class="flex items-center justify-between gap-2">
          <div class="text-xs uppercase text-slate-400">Сводка по контрагентам</div>
          <input
            v-model="summarySearch"
            type="text"
            placeholder="Поиск контрагента..."
            class="w-full max-w-[280px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>

        <div class="mt-3 overflow-x-auto rounded-lg border border-slate-800">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-2 text-left">
                  <button type="button" class="hover:text-white" @click="toggleSummarySort('contractor')">
                    Контрагент
                  </button>
                </th>
                <th class="px-2 py-2 text-right">
                  <button type="button" class="hover:text-white" @click="toggleSummarySort('totalDebt')">
                    Долг, ₽
                  </button>
                </th>
                <th class="px-2 py-2 text-right">Строк</th>
                <th class="px-2 py-2 text-right">Накладных</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingSummary">
                <td colspan="4" class="px-2 py-4 text-center text-slate-400">Загрузка сводки долгов...</td>
              </tr>
              <tr
                v-for="row in summaryFiltered"
                :key="row.contractor"
                class="border-t border-slate-800 cursor-pointer hover:bg-slate-900"
                :class="activeContractor === row.contractor ? 'bg-slate-900/60' : ''"
                @click="selectContractor(row.contractor)"
              >
                <td class="px-2 py-2">
                  <div class="font-medium text-slate-100">{{ row.contractor }}</div>
                  <div class="text-[11px] text-slate-400">Строк: {{ row.itemsCount }} · Накл: {{ row.invoicesCount }}</div>
                </td>
                <td class="px-2 py-2 text-right font-semibold" :class="row.totalDebt > 0 ? 'text-amber-300' : 'text-slate-100'">
                  {{ formatMoney(row.totalDebt) }}
                </td>
                <td class="px-2 py-2 text-right">{{ row.itemsCount }}</td>
                <td class="px-2 py-2 text-right">{{ row.invoicesCount }}</td>
              </tr>
              <tr v-if="!loadingSummary && summaryFiltered.length === 0">
                <td colspan="4" class="px-2 py-4 text-center text-slate-400">Неоплаченных долгов по контрагентам нет</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-200">
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <div class="text-xs uppercase text-slate-400">
            Детализация
            <span v-if="activeContractor" class="text-slate-100">· {{ activeContractor }}</span>
          </div>
          <div class="flex items-center gap-2">
            <input
              v-model="detailsSearch"
              type="text"
              placeholder="Поиск по строкам..."
              class="w-full max-w-[260px] rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              :disabled="!activeContractor"
            />
            <button
              v-if="activeContractor"
              type="button"
              class="px-2 py-1 rounded border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
              @click="reloadDetails"
            >
              Обновить
            </button>
          </div>
        </div>

        <div v-if="detailsError" class="mt-2 text-xs text-red-400">{{ detailsError }}</div>

        <div v-if="activeContractor" class="mt-3 space-y-3">
          <div class="flex items-center justify-between gap-2 text-xs">
            <label class="inline-flex items-center gap-2 text-slate-300">
              <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
              <span>Выбрать всё</span>
            </label>
            <div class="text-[11px] text-slate-400">
              Строк: {{ detailsFiltered.length }} · Выбрано: {{ selectedItemIds.length }} · Сумма: {{ formatMoney(selectedAmount) }} ₽
            </div>
          </div>

          <div class="overflow-x-auto rounded-lg border border-slate-800">
            <table class="min-w-full text-[11px]">
              <thead class="bg-slate-900 text-slate-300">
                <tr>
                  <th class="px-2 py-2"></th>
                  <th class="px-2 py-2 text-left">
                    <button type="button" class="hover:text-white" @click="toggleDetailsSort('date')">Дата</button>
                  </th>
                  <th class="px-2 py-2 text-left">№</th>
                  <th class="px-2 py-2 text-left">Товар</th>
                  <th class="px-2 py-2 text-right">Кол-во</th>
                  <th class="px-2 py-2 text-left">Ед.</th>
                  <th class="px-2 py-2 text-right">Цена</th>
                  <th class="px-2 py-2 text-right">
                    <button type="button" class="hover:text-white" @click="toggleDetailsSort('amount')">Сумма</button>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="detailsLoading">
                  <td colspan="8" class="px-2 py-4 text-center text-slate-400">Загрузка строк долгов...</td>
                </tr>
                <tr
                  v-for="row in detailsFiltered"
                  :key="row.itemId"
                  class="border-t border-slate-800 hover:bg-slate-900/60"
                >
                  <td class="px-2 py-2 text-center">
                    <input type="checkbox" :value="row.itemId" v-model="selectedItemIds" />
                  </td>
                  <td class="px-2 py-2">{{ formatDate(row.date) }}</td>
                  <td class="px-2 py-2">{{ row.number }}</td>
                  <td class="px-2 py-2">{{ row.name }}</td>
                  <td class="px-2 py-2 text-right">{{ formatNumber(row.quantity) }}</td>
                  <td class="px-2 py-2">{{ row.unit }}</td>
                  <td class="px-2 py-2 text-right">{{ formatMoney(row.salePrice) }}</td>
                  <td class="px-2 py-2 text-right font-medium">{{ formatMoney(row.amount) }}</td>
                </tr>
                <tr v-if="!detailsLoading && detailsFiltered.length === 0">
                  <td colspan="8" class="px-2 py-4 text-center text-slate-400">Нет неоплаченных строк по выбранному контрагенту</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex items-start justify-between gap-3 flex-wrap">
            <button
              type="button"
              class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="markPaidLoading || selectedItemIds.length === 0"
              @click="markSelectedAsPaid"
            >
              {{ markPaidLoading ? 'Отмечаем...' : 'Отметить выбранное как оплачено' }}
            </button>
            <div class="text-right space-y-1 text-xs">
              <div v-if="markPaidError" class="text-red-400">{{ markPaidError }}</div>
              <div v-if="markPaidSuccess" class="text-emerald-400">Строки отмечены как оплаченные</div>
            </div>
          </div>
        </div>

        <div v-else class="mt-3 text-xs text-slate-400">
          Выберите контрагента слева, чтобы увидеть детализацию долгов.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

interface DebtSummaryRow {
  contractor: string;
  totalDebt: number;
  itemsCount: number;
  invoicesCount: number;
}

interface DebtDetailRow {
  itemId: string;
  invoiceId: string;
  number: string;
  date: string;
  name: string;
  quantity: number;
  unit: string;
  salePrice: number;
  amount: number;
}

const summary = ref<DebtSummaryRow[]>([]);
const loadingSummary = ref(false);
const summaryError = ref('');

const activeContractor = ref<string | null>(null);
const details = ref<DebtDetailRow[]>([]);
const detailsLoading = ref(false);
const detailsError = ref('');

const selectedItemIds = ref<string[]>([]);
const markPaidLoading = ref(false);
const markPaidError = ref('');
const markPaidSuccess = ref(false);

const summarySearch = ref('');
const detailsSearch = ref('');
const summarySort = ref<{ key: 'totalDebt' | 'contractor'; dir: 'asc' | 'desc' }>({ key: 'totalDebt', dir: 'desc' });
const detailsSort = ref<{ key: 'date' | 'amount'; dir: 'asc' | 'desc' }>({ key: 'date', dir: 'asc' });

const formatMoney = (v: number | null | undefined) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (v: number | null | undefined) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

const formatDate = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('ru-RU');
};

const loadSummary = async () => {
  loadingSummary.value = true;
  summaryError.value = '';
  try {
    const res = await axios.get('/api/v1/invoices/contractors/debts');
    summary.value = (res.data?.rows || []) as DebtSummaryRow[];
  } catch (e: any) {
    summaryError.value = e?.response?.data?.message || 'Ошибка загрузки сводки долгов';
  } finally {
    loadingSummary.value = false;
  }
};

const totalDebtAll = computed(() => {
  return summary.value.reduce((acc, r) => acc + (Number(r.totalDebt) || 0), 0);
});

const summaryFiltered = computed(() => {
  const q = summarySearch.value.trim().toLowerCase();
  const base = q
    ? summary.value.filter((r) => String(r.contractor || '').toLowerCase().includes(q))
    : summary.value.slice();

  const { key, dir } = summarySort.value;
  base.sort((a, b) => {
    let va: any = (a as any)[key];
    let vb: any = (b as any)[key];
    if (key === 'contractor') {
      va = String(va || '').toLowerCase();
      vb = String(vb || '').toLowerCase();
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    }
    va = Number(va) || 0;
    vb = Number(vb) || 0;
    return dir === 'asc' ? va - vb : vb - va;
  });
  return base;
});

const loadDetails = async (contractor: string) => {
  if (!contractor) return;
  activeContractor.value = contractor;
  detailsLoading.value = true;
  detailsError.value = '';
  selectedItemIds.value = [];
  markPaidSuccess.value = false;

  try {
    const res = await axios.get(`/api/v1/invoices/contractors/${encodeURIComponent(contractor)}/debts`);
    details.value = (res.data?.items || []) as DebtDetailRow[];
  } catch (e: any) {
    detailsError.value = e?.response?.data?.message || 'Ошибка загрузки детализации долгов';
  } finally {
    detailsLoading.value = false;
  }
};

const selectContractor = (name: string) => {
  loadDetails(name);
};

const reloadDetails = () => {
  if (activeContractor.value) {
    loadDetails(activeContractor.value);
  }
};

const allSelected = computed(() => {
  if (!details.value.length) return false;
  return details.value.every((d) => selectedItemIds.value.includes(d.itemId));
});

const selectedAmount = computed(() => {
  const set = new Set(selectedItemIds.value);
  return details.value.reduce((acc, r) => {
    if (!set.has(r.itemId)) return acc;
    return acc + (Number(r.amount) || 0);
  }, 0);
});

const detailsFiltered = computed(() => {
  const q = detailsSearch.value.trim().toLowerCase();
  const base = q
    ? details.value.filter((r) => {
        const hay = `${r.number} ${r.name}`.toLowerCase();
        return hay.includes(q);
      })
    : details.value.slice();

  const { key, dir } = detailsSort.value;
  base.sort((a, b) => {
    if (key === 'date') {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return dir === 'asc' ? da - db : db - da;
    }
    const va = Number(a.amount) || 0;
    const vb = Number(b.amount) || 0;
    return dir === 'asc' ? va - vb : vb - va;
  });

  return base;
});

const toggleSummarySort = (key: 'totalDebt' | 'contractor') => {
  if (summarySort.value.key === key) {
    summarySort.value.dir = summarySort.value.dir === 'asc' ? 'desc' : 'asc';
  } else {
    summarySort.value.key = key;
    summarySort.value.dir = key === 'contractor' ? 'asc' : 'desc';
  }
};

const toggleDetailsSort = (key: 'date' | 'amount') => {
  if (detailsSort.value.key === key) {
    detailsSort.value.dir = detailsSort.value.dir === 'asc' ? 'desc' : 'asc';
  } else {
    detailsSort.value.key = key;
    detailsSort.value.dir = key === 'date' ? 'asc' : 'desc';
  }
};

const toggleSelectAll = () => {
  if (allSelected.value) {
    selectedItemIds.value = [];
  } else {
    selectedItemIds.value = details.value.map((d) => d.itemId);
  }
};

const markSelectedAsPaid = async () => {
  if (!selectedItemIds.value.length) return;
  markPaidLoading.value = true;
  markPaidError.value = '';
  markPaidSuccess.value = false;

  try {
    await axios.post('/api/v1/invoices/contractors/mark-paid', {
      itemIds: selectedItemIds.value,
    });

    markPaidSuccess.value = true;
    await loadSummary();
    if (activeContractor.value) {
      await loadDetails(activeContractor.value);
    }
  } catch (e: any) {
    markPaidError.value = e?.response?.data?.message || 'Ошибка при отметке строк как оплаченных';
  } finally {
    markPaidLoading.value = false;
  }
};

onMounted(() => {
  loadSummary();
});
</script>
