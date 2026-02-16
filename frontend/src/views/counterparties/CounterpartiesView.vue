<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Контрагенты (поставщики)</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-sm text-slate-200">
      <h2 class="font-semibold text-sm">Добавить / изменить контрагента</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs text-slate-400 mb-1">Имя контрагента</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            placeholder="Например: ООО ЭКОПЛАНТТ"
          />
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">Телефон</label>
          <input
            v-model="form.phone"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
            placeholder="Например: +7 999 123-45-67"
          />
        </div>
        <div class="flex items-end gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm disabled:opacity-60"
            :disabled="saving || !form.name.trim()"
            @click="onSave"
          >
            {{ editingId ? 'Сохранить изменения' : 'Добавить контрагента' }}
          </button>
          <button
            v-if="editingId"
            type="button"
            class="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-60"
            :disabled="saving"
            @click="onCancelEdit"
          >
            Отмена
          </button>
        </div>
      </div>
      <div v-if="error" class="text-xs text-red-400">{{ error }}</div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-sm text-slate-200">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm">Список контрагентов</span>
          <label class="inline-flex items-center gap-1 text-xs text-slate-300">
            <input
              type="checkbox"
              v-model="showArchive"
              class="rounded border-slate-600 bg-slate-900"
              @change="onToggleArchive"
            />
            <span>Показать архив</span>
          </label>
        </div>
        <div v-if="loading" class="text-xs text-slate-400">Загрузка...</div>
        <div v-if="listError" class="text-xs text-red-400">{{ listError }}</div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Имя</th>
              <th class="px-2 py-1 text-left">Телефон</th>
              <th class="px-2 py-1 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in counterparties"
              :key="c._id"
              class="border-t border-slate-800 hover:bg-slate-900/60"
            >
              <td class="px-2 py-1">{{ c.name }}</td>
              <td class="px-2 py-1">{{ c.phone || '-' }}</td>
              <td class="px-2 py-1 text-right space-x-1">
                <button
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs"
                  @click="startEdit(c)"
                >
                  Редактировать
                </button>
                <button
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs"
                  @click="openReport(c)"
                >
                  Отчёт
                </button>
                <button
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs"
                  @click="openPrint(c)"
                >
                  Печать
                </button>
                <button
                  v-if="!showArchive"
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-xs"
                  @click="archiveCounterparty(c)"
                >
                  В архив
                </button>
                <button
                  v-else
                  type="button"
                  class="inline-flex items-center px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-xs"
                  @click="restoreCounterparty(c)"
                >
                  Восстановить
                </button>
              </td>
            </tr>
            <tr v-if="!loading && counterparties.length === 0">
              <td colspan="3" class="px-2 py-3 text-center text-slate-400">
                Нет контрагентов. Добавьте первого выше.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="report.counterpartyId"
      class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3 text-sm text-slate-200"
    >
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div class="font-semibold text-sm">Отчёт по контрагенту: {{ report.counterpartyName }}</div>
        </div>
        <div class="flex items-center gap-2 flex-wrap text-xs">
          <div class="flex items-center gap-1">
            <label class="text-slate-400">Вид</label>
            <select
              v-model="reportMode"
              class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
              :disabled="report.loading"
              @change="reloadActiveReport"
            >
              <option value="items">По товарам</option>
              <option value="invoices">По накладным</option>
            </select>
          </div>
          <div class="flex items-center gap-1">
            <label class="text-slate-400">Дата с</label>
            <input
              v-model="report.from"
              type="date"
              class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
          </div>
          <div class="flex items-center gap-1">
            <label class="text-slate-400">по</label>
            <input
              v-model="report.to"
              type="date"
              class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
          </div>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
              :disabled="report.loading"
              @click="setReportPreset('day')"
            >
              День
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
              :disabled="report.loading"
              @click="setReportPreset('week')"
            >
              Неделя
            </button>
            <button
              type="button"
              class="px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
              :disabled="report.loading"
              @click="setReportPreset('month')"
            >
              Месяц
            </button>
          </div>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-60"
            :disabled="report.loading"
            @click="reloadActiveReport"
          >
            {{ report.loading ? 'Загружаем...' : 'Обновить отчёт' }}
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs disabled:opacity-60"
            :disabled="report.loading || (reportMode === 'items' ? !report.items.length : !invoiceReport.rows.length)"
            @click="exportReportCsv"
          >
            CSV
          </button>
          <button
            type="button"
            class="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs"
            @click="closeReport"
          >
            Закрыть
          </button>
        </div>
      </div>

      <div v-if="report.error" class="text-xs text-red-400">{{ report.error }}</div>

      <div v-if="!report.loading" class="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div class="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div class="text-slate-400">Закупка (нал)</div>
          <div class="text-lg">{{ formatMoney(report.summary.totalPurchaseCash) }}</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div class="text-slate-400">Закупка (безнал)</div>
          <div class="text-lg">{{ formatMoney(report.summary.totalPurchaseCashless) }}</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div class="text-slate-400">Продажи всего</div>
          <div class="text-lg">{{ formatMoney(report.summary.totalSale) }}</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-lg p-2">
          <div class="text-slate-400">Прибыль</div>
          <div class="text-lg">{{ formatMoney(report.summary.totalIncome) }}</div>
        </div>
      </div>

      <div v-if="!report.loading && reportMode === 'items'" class="mt-3 flex flex-wrap gap-2 items-end text-xs">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Поиск по товару</label>
          <input
            v-model="reportSearch"
            type="text"
            placeholder="Название / ед."
            class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          />
        </div>
        <div class="ml-auto text-[11px] text-slate-300">
          <div>Строк: {{ sortedReportItems.length }}</div>
          <div>
            Итого по фильтру:
            {{ formatMoney(reportTotals.totalPurchaseCash) }} / {{ formatMoney(reportTotals.totalPurchaseCashless) }} / {{ formatMoney(reportTotals.totalSale) }} /
            {{ formatMoney(reportTotals.totalIncome) }}
          </div>
        </div>
      </div>

      <div v-if="reportMode === 'items'" class="overflow-x-auto mt-3">
        <table class="min-w-full text-xs">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left cursor-pointer select-none" @click="toggleReportSort('name')">
                Товар
                <span v-if="reportSort.key === 'name'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="px-2 py-1 text-left cursor-pointer select-none" @click="toggleReportSort('unit')">
                Ед.
                <span v-if="reportSort.key === 'unit'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="px-2 py-1 text-right cursor-pointer select-none" @click="toggleReportSort('totalQty')">
                Кол-во
                <span v-if="reportSort.key === 'totalQty'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="px-2 py-1 text-right cursor-pointer select-none" @click="toggleReportSort('totalPurchaseCash')">
                Закупка (нал)
                <span v-if="reportSort.key === 'totalPurchaseCash'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="px-2 py-1 text-right cursor-pointer select-none" @click="toggleReportSort('totalPurchaseCashless')">
                Закупка (безнал)
                <span v-if="reportSort.key === 'totalPurchaseCashless'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="px-2 py-1 text-right cursor-pointer select-none" @click="toggleReportSort('totalSale')">
                Продажи
                <span v-if="reportSort.key === 'totalSale'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
              <th class="px-2 py-1 text-right cursor-pointer select-none" @click="toggleReportSort('totalIncome')">
                Прибыль
                <span v-if="reportSort.key === 'totalIncome'">{{ reportSort.dir === 'asc' ? ' ▲' : ' ▼' }}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in sortedReportItems"
              :key="row.name + '|' + row.unit"
              class="border-t border-slate-800"
            >
              <td class="px-2 py-1">{{ row.name }}</td>
              <td class="px-2 py-1">{{ row.unit }}</td>
              <td class="px-2 py-1 text-right">{{ row.totalQty }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.totalPurchaseCash) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.totalPurchaseCashless) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.totalSale) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.totalIncome) }}</td>
            </tr>
            <tr v-if="!report.loading && report.items.length === 0">
              <td colspan="7" class="px-2 py-3 text-center text-slate-400">
                За выбранный период данных по этому контрагенту нет.
              </td>
            </tr>
            <tr v-if="!report.loading && report.items.length > 0 && sortedReportItems.length === 0">
              <td colspan="7" class="px-2 py-3 text-center text-slate-400">
                Ничего не найдено по фильтру.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="mt-3 space-y-2">
        <div class="flex flex-wrap items-end gap-2 text-xs">
          <label class="inline-flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              v-model="invoiceReport.onlyUnpaid"
              class="rounded border-slate-600 bg-slate-900"
              @change="reloadActiveReport"
            />
            <span>Только неоплаченные строки</span>
          </label>
          <div class="ml-auto text-[11px] text-slate-300">
            <div>Накладных: {{ invoiceReport.rows.length }}</div>
            <div>
              Итого:
              {{ formatMoney(invoiceReport.summary.totalPurchaseCash) }} / {{ formatMoney(invoiceReport.summary.totalPurchaseCashless) }} /
              {{ formatMoney(invoiceReport.summary.totalSale) }} / {{ formatMoney(invoiceReport.summary.totalIncome) }}
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2 text-xs">
          <label class="inline-flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" :checked="allInvoicesSelected" @change="toggleSelectAllInvoices" />
            <span>Выбрать всё</span>
          </label>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs disabled:opacity-60"
              :disabled="markPaid.loading || selectedInvoiceItemIds.length === 0"
              @click="markSelectedInvoiceItemsPaid"
            >
              {{ markPaid.loading ? 'Отмечаем...' : 'Отметить выбранное как оплачено' }}
            </button>
          </div>
        </div>
        <div v-if="markPaid.error" class="text-xs text-red-400">{{ markPaid.error }}</div>
        <div v-if="markPaid.success" class="text-xs text-emerald-400">Отмечено как оплачено</div>

        <div class="overflow-x-auto border border-slate-800 rounded-lg">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-1"></th>
                <th class="px-2 py-1 text-left">Дата</th>
                <th class="px-2 py-1 text-left">№ накладной</th>
                <th class="px-2 py-1 text-right">Действия</th>
                <th class="px-2 py-1 text-left">Тип</th>
                <th class="px-2 py-1 text-right">Строк</th>
                <th class="px-2 py-1 text-right">Кол-во</th>
                <th class="px-2 py-1 text-right">Закупка (нал)</th>
                <th class="px-2 py-1 text-right">Закупка (безнал)</th>
                <th class="px-2 py-1 text-right">Продажи</th>
                <th class="px-2 py-1 text-right">Прибыль</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="inv in invoiceReport.rows"
                :key="inv.invoiceId"
                class="border-t border-slate-800 hover:bg-slate-900/60"
              >
                <td class="px-2 py-1 text-center">
                  <input type="checkbox" :value="inv.invoiceId" v-model="selectedInvoiceIds" />
                </td>
                <td class="px-2 py-1">{{ formatDate(inv.date) }}</td>
                <td class="px-2 py-1">{{ inv.number }}</td>
                <td class="px-2 py-1 text-right">
                  <button
                    type="button"
                    class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] text-white"
                    @click="openInvoicePrint(inv.invoiceId)"
                  >
                    Печать
                  </button>
                </td>
                <td class="px-2 py-1">{{ inv.paymentType === 'cash' ? 'Нал' : 'Безнал' }}</td>
                <td class="px-2 py-1 text-right">{{ inv.itemsCount }}</td>
                <td class="px-2 py-1 text-right">{{ inv.totalQty }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(inv.totalPurchaseCash) }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(inv.totalPurchaseCashless) }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(inv.totalSale) }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(inv.totalIncome) }}</td>
              </tr>
              <tr v-if="!report.loading && invoiceReport.rows.length === 0">
                <td colspan="11" class="px-2 py-3 text-center text-slate-400">Нет накладных за выбранный период.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-[11px] text-slate-300">
          <div>Выбрано накладных: {{ selectedInvoiceIds.length }}</div>
          <div>Сумма выбранного (нал/безнал/продажи/прибыль): {{ formatMoney(selectedTotals.totalPurchaseCash) }} / {{ formatMoney(selectedTotals.totalPurchaseCashless) }} / {{ formatMoney(selectedTotals.totalSale) }} / {{ formatMoney(selectedTotals.totalIncome) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

interface CounterpartyDto {
  _id: string;
  name: string;
  phone?: string;
  isActive?: boolean;
}

const counterparties = ref<CounterpartyDto[]>([]);
const loading = ref(false);
const listError = ref('');

const router = useRouter();

const form = ref<{ name: string; phone: string }>({ name: '', phone: '' });

const allInvoicesSelected = computed(() => {
  if (!invoiceReport.value.rows.length) return false;
  return invoiceReport.value.rows.every((r) => selectedInvoiceIds.value.includes(r.invoiceId));
});

const selectedInvoiceItemIds = computed(() => {
  if (!selectedInvoiceIds.value.length) return [];
  const set = new Set<string>();
  for (const r of invoiceReport.value.rows) {
    if (selectedInvoiceIds.value.includes(r.invoiceId)) {
      for (const id of r.itemIds || []) {
        set.add(String(id));
      }
    }
  }
  return Array.from(set);
});

const selectedTotals = computed(() => {
  return invoiceReport.value.rows.reduce(
    (acc, r) => {
      if (!selectedInvoiceIds.value.includes(r.invoiceId)) return acc;
      acc.totalPurchaseCash += Number(r.totalPurchaseCash) || 0;
      acc.totalPurchaseCashless += Number(r.totalPurchaseCashless) || 0;
      acc.totalSale += Number(r.totalSale) || 0;
      acc.totalIncome += Number(r.totalIncome) || 0;
      return acc;
    },
    { totalPurchaseCash: 0, totalPurchaseCashless: 0, totalSale: 0, totalIncome: 0 },
  );
});
const editingId = ref<string | null>(null);
const saving = ref(false);
const error = ref('');

const showArchive = ref(false);

interface CounterpartyReportSummary {
  totalPurchaseCash: number;
  totalPurchaseCashless: number;
  totalSale: number;
  totalIncome: number;
}

interface CounterpartyReportItemRow {
  name: string;
  unit: string;
  totalQty: number;
  totalPurchaseCash: number;
  totalPurchaseCashless: number;
  totalSale: number;
  totalIncome: number;
}

interface CounterpartyInvoicesSummary {
  invoicesCount: number;
  itemsCount: number;
  totalQty: number;
  totalPurchaseCash: number;
  totalPurchaseCashless: number;
  totalSale: number;
  totalIncome: number;
}

interface CounterpartyInvoiceRow {
  invoiceId: string;
  number: string;
  date: string;
  paymentType: 'cash' | 'cashless';
  itemsCount: number;
  totalQty: number;
  totalPurchaseCash: number;
  totalPurchaseCashless: number;
  totalSale: number;
  totalIncome: number;
  itemIds: string[];
}

const report = ref({
  counterpartyId: '' as string,
  counterpartyName: '' as string,
  from: '' as string,
  to: '' as string,
  loading: false,
  error: '' as string,
  summary: {
    totalPurchaseCash: 0,
    totalPurchaseCashless: 0,
    totalSale: 0,
    totalIncome: 0,
  } as CounterpartyReportSummary,
  items: [] as CounterpartyReportItemRow[],
});

const reportMode = ref<'items' | 'invoices'>('items');

const invoiceReport = ref({
  onlyUnpaid: true,
  summary: {
    invoicesCount: 0,
    itemsCount: 0,
    totalQty: 0,
    totalPurchaseCash: 0,
    totalPurchaseCashless: 0,
    totalSale: 0,
    totalIncome: 0,
  } as CounterpartyInvoicesSummary,
  rows: [] as CounterpartyInvoiceRow[],
});

const selectedInvoiceIds = ref<string[]>([]);
const markPaid = ref({ loading: false, error: '', success: false });

const reportSearch = ref('');

type ReportSortKey = 'name' | 'unit' | 'totalQty' | 'totalPurchaseCash' | 'totalPurchaseCashless' | 'totalSale' | 'totalIncome';
const reportSort = ref<{ key: ReportSortKey; dir: 'asc' | 'desc' }>({ key: 'totalIncome', dir: 'desc' });

const filteredReportItems = computed(() => {
  const q = reportSearch.value.trim().toLowerCase();
  if (!q) return report.value.items;
  return report.value.items.filter((r) => {
    const name = String(r.name || '').toLowerCase();
    const unit = String(r.unit || '').toLowerCase();
    return name.includes(q) || unit.includes(q);
  });
});

const sortedReportItems = computed(() => {
  const key = reportSort.value.key;
  const dir = reportSort.value.dir;
  const arr = [...filteredReportItems.value];
  const mul = dir === 'asc' ? 1 : -1;

  arr.sort((a, b) => {
    const av: any = (a as any)[key];
    const bv: any = (b as any)[key];

    const an = Number(av);
    const bn = Number(bv);
    const bothNumeric = Number.isFinite(an) && Number.isFinite(bn);
    if (bothNumeric) {
      if (an === bn) return 0;
      return an > bn ? mul : -mul;
    }

    const as = String(av ?? '').toLowerCase();
    const bs = String(bv ?? '').toLowerCase();
    if (as === bs) return 0;
    return as > bs ? mul : -mul;
  });

  return arr;
});

const reportTotals = computed(() => {
  return sortedReportItems.value.reduce(
    (acc, r) => {
      acc.totalPurchaseCash += Number(r.totalPurchaseCash) || 0;
      acc.totalPurchaseCashless += Number(r.totalPurchaseCashless) || 0;
      acc.totalSale += Number(r.totalSale) || 0;
      acc.totalIncome += Number(r.totalIncome) || 0;
      return acc;
    },
    { totalPurchaseCash: 0, totalPurchaseCashless: 0, totalSale: 0, totalIncome: 0 },
  );
});

const loadList = async () => {
  loading.value = true;
  listError.value = '';
  try {
    const url = showArchive.value ? '/api/v1/counterparties/archived' : '/api/v1/counterparties';
    const res = await axios.get(url);
    counterparties.value = res.data?.counterparties || [];
  } catch (e: any) {
    listError.value = e?.response?.data?.message || 'Ошибка загрузки контрагентов';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadList();
});

const resetForm = () => {
  form.value = { name: '', phone: '' };
  editingId.value = null;
  error.value = '';
};

const onSave = async () => {
  if (!form.value.name.trim()) return;
  saving.value = true;
  error.value = '';
  try {
    if (editingId.value) {
      await axios.put(`/api/v1/counterparties/${editingId.value}`, {
        name: form.value.name.trim(),
        phone: form.value.phone.trim() || undefined,
      });
    } else {
      await axios.post('/api/v1/counterparties', {
        name: form.value.name.trim(),
        phone: form.value.phone.trim() || undefined,
      });
    }
    await loadList();
    resetForm();
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка сохранения контрагента';
  } finally {
    saving.value = false;
  }
};

const startEdit = (c: CounterpartyDto) => {
  editingId.value = c._id;
  form.value = {
    name: c.name,
    phone: c.phone || '',
  };
};

const onCancelEdit = () => {
  resetForm();
};

const archiveCounterparty = async (c: CounterpartyDto) => {
  if (!c._id) return;
  try {
    await axios.delete(`/api/v1/counterparties/${c._id}`);
    await loadList();
  } catch (e: any) {
    listError.value = e?.response?.data?.message || 'Ошибка архивации контрагента';
  }
};

const restoreCounterparty = async (c: CounterpartyDto) => {
  if (!c._id) return;
  try {
    await axios.put(`/api/v1/counterparties/${c._id}`, { isActive: true });
    await loadList();
  } catch (e: any) {
    listError.value = e?.response?.data?.message || 'Ошибка восстановления контрагента';
  }
};

const onToggleArchive = () => {
  loadList();
};

const openReport = (c: CounterpartyDto) => {
  report.value.counterpartyId = c._id;
  report.value.counterpartyName = c.name;
  reportSearch.value = '';
  selectedInvoiceIds.value = [];
  markPaid.value = { loading: false, error: '', success: false };
  // по умолчанию — текущий месяц
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const yyyyMmDd = (d: Date) => d.toISOString().slice(0, 10);
  report.value.from = report.value.from || yyyyMmDd(firstDay);
  report.value.to = report.value.to || yyyyMmDd(now);
  reloadActiveReport();
};

const openPrint = (c: CounterpartyDto) => {
  const query: any = {};
  if (report.value.counterpartyId === c._id) {
    if (report.value.from) query.from = report.value.from;
    if (report.value.to) query.to = report.value.to;
  }
  router.push({ name: 'counterpartyPrint', params: { id: c._id }, query });
};

const openInvoicePrint = (invoiceId: string) => {
  if (!invoiceId) return;
  router.push({ name: 'invoicePrint', params: { id: invoiceId } });
};

const closeReport = () => {
  report.value.counterpartyId = '';
  report.value.counterpartyName = '';
  report.value.error = '';
  report.value.items = [];
  reportSearch.value = '';
  selectedInvoiceIds.value = [];
  invoiceReport.value.rows = [];
  invoiceReport.value.summary = {
    invoicesCount: 0,
    itemsCount: 0,
    totalQty: 0,
    totalPurchaseCash: 0,
    totalPurchaseCashless: 0,
    totalSale: 0,
    totalIncome: 0,
  };
  markPaid.value = { loading: false, error: '', success: false };
};

const loadReport = async () => {
  if (!report.value.counterpartyId) return;
  report.value.loading = true;
  report.value.error = '';
  try {
    const params: Record<string, string> = {};
    if (report.value.from) params.from = report.value.from;
    if (report.value.to) params.to = report.value.to;
    const qs = new URLSearchParams(params).toString();

    const res = await axios.get(`/api/v1/counterparty-reports/${report.value.counterpartyId}/report${qs ? `?${qs}` : ''}`);
    const data = res.data || {};
    report.value.summary = {
      totalPurchaseCash: Number(data.summary?.totalPurchaseCash) || 0,
      totalPurchaseCashless: Number(data.summary?.totalPurchaseCashless) || 0,
      totalSale: Number(data.summary?.totalSale) || 0,
      totalIncome: Number(data.summary?.totalIncome) || 0,
    };
    report.value.items = (data.items || []) as CounterpartyReportItemRow[];
  } catch (e: any) {
    report.value.error = e?.response?.data?.message || 'Ошибка загрузки отчёта по контрагенту';
  } finally {
    report.value.loading = false;
  }
};

const loadInvoicesReport = async () => {
  if (!report.value.counterpartyId) return;
  report.value.loading = true;
  report.value.error = '';
  try {
    const params: any = {};
    if (report.value.from) params.from = report.value.from;
    if (report.value.to) params.to = report.value.to;
    params.onlyUnpaid = invoiceReport.value.onlyUnpaid ? 'true' : 'false';

    const res = await axios.get(`/api/v1/counterparty-reports/${report.value.counterpartyId}/invoices`, { params });
    const data = res.data || {};
    invoiceReport.value.summary = data.summary as CounterpartyInvoicesSummary;
    invoiceReport.value.rows = (data.invoices || []) as CounterpartyInvoiceRow[];
    selectedInvoiceIds.value = [];
    markPaid.value = { loading: false, error: '', success: false };
  } catch (e: any) {
    report.value.error = e?.response?.data?.message || 'Ошибка загрузки отчёта по накладным';
    invoiceReport.value.rows = [];
  } finally {
    report.value.loading = false;
  }
};

const reloadActiveReport = async () => {
  if (reportMode.value === 'items') {
    await loadReport();
  } else {
    await loadInvoicesReport();
  }
};

type ReportPreset = 'day' | 'week' | 'month';
const setReportPreset = (preset: ReportPreset) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (preset === 'day') {
    // today
  } else if (preset === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
  } else if (preset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const yyyyMmDd = (d: Date) => d.toISOString().slice(0, 10);
  report.value.from = yyyyMmDd(start);
  report.value.to = yyyyMmDd(end);
  reloadActiveReport();
};

const toggleSelectAllInvoices = () => {
  if (allInvoicesSelected.value) {
    selectedInvoiceIds.value = [];
  } else {
    selectedInvoiceIds.value = invoiceReport.value.rows.map((r) => r.invoiceId);
  }
};

const markSelectedInvoiceItemsPaid = async () => {
  const ids = selectedInvoiceItemIds.value;
  if (!ids.length) return;
  if (!window.confirm('Отметить выбранные строки накладных как оплаченные контрагенту?')) return;

  markPaid.value = { loading: true, error: '', success: false };
  try {
    await axios.post('/api/v1/invoices/contractors/mark-paid', { itemIds: ids });
    markPaid.value = { loading: false, error: '', success: true };
    await loadInvoicesReport();
  } catch (e: any) {
    markPaid.value = {
      loading: false,
      error: e?.response?.data?.message || 'Ошибка при отметке как оплачено',
      success: false,
    };
  }
};

const toggleReportSort = (key: ReportSortKey) => {
  if (reportSort.value.key === key) {
    reportSort.value.dir = reportSort.value.dir === 'asc' ? 'desc' : 'asc';
  } else {
    reportSort.value.key = key;
    reportSort.value.dir = key === 'name' || key === 'unit' ? 'asc' : 'desc';
  }
};

const exportReportCsv = () => {
  const isItems = reportMode.value === 'items';
  const rows: any[] = isItems ? sortedReportItems.value : invoiceReport.value.rows;
  const header = isItems
    ? ['Товар', 'Ед.', 'Кол-во', 'Закупка (нал)', 'Закупка (безнал)', 'Продажи', 'Прибыль']
    : ['Дата', '№ накладной', 'Тип', 'Строк', 'Кол-во', 'Закупка (нал)', 'Закупка (безнал)', 'Продажи', 'Прибыль'];
  const escape = (v: any) => {
    const s = String(v ?? '');
    if (/["\n\r;,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };

  const lines: string[] = [];
  lines.push(header.join(';'));
  if (isItems) {
    for (const r of rows) {
      lines.push(
        [
          escape(r.name),
          escape(r.unit),
          escape(r.totalQty),
          escape(r.totalPurchaseCash),
          escape(r.totalPurchaseCashless),
          escape(r.totalSale),
          escape(r.totalIncome),
        ].join(';'),
      );
    }

    lines.push(
      [
        'ИТОГО',
        '',
        '',
        escape(reportTotals.value.totalPurchaseCash),
        escape(reportTotals.value.totalPurchaseCashless),
        escape(reportTotals.value.totalSale),
        escape(reportTotals.value.totalIncome),
      ].join(';'),
    );
  } else {
    for (const r of rows) {
      lines.push(
        [
          escape(formatDate(r.date)),
          escape(r.number),
          escape(r.paymentType === 'cash' ? 'Нал' : 'Безнал'),
          escape(r.itemsCount),
          escape(r.totalQty),
          escape(r.totalPurchaseCash),
          escape(r.totalPurchaseCashless),
          escape(r.totalSale),
          escape(r.totalIncome),
        ].join(';'),
      );
    }

    lines.push(
      [
        'ИТОГО',
        '',
        '',
        escape(invoiceReport.value.summary.itemsCount),
        escape(invoiceReport.value.summary.totalQty),
        escape(invoiceReport.value.summary.totalPurchaseCash),
        escape(invoiceReport.value.summary.totalPurchaseCashless),
        escape(invoiceReport.value.summary.totalSale),
        escape(invoiceReport.value.summary.totalIncome),
      ].join(';'),
    );
  }

  const bom = '\uFEFF';
  const content = bom + lines.join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const safeName = String(report.value.counterpartyName || 'report').replace(/[\\/:*?"<>|]/g, '_');
  const period = `${report.value.from || ''}-${report.value.to || ''}`.replace(/[\\/:*?"<>|]/g, '_');
  a.download = `counterparty-${safeName}-${reportMode.value}-${period}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const formatDate = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('ru-RU');
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
</script>

<style scoped></style>
