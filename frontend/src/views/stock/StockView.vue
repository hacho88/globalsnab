<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Наш склад</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
      <div class="text-sm text-slate-200 mb-1">Добавить товар на склад</div>
      <div class="flex flex-wrap gap-3 items-end text-xs text-slate-300">
        <div class="flex flex-col">
          <label class="mb-1">Артикул или часть названия</label>
          <datalist id="stock-products-list">
            <option v-for="p in allProducts" :key="p._id" :value="p.sku || ''">{{ p.name }}</option>
          </datalist>
          <input
            v-model="addQuery"
            type="text"
            placeholder="Например: 0001 или Пескобетон"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[220px]"
            list="stock-products-list"
          />
        </div>
        <div class="flex flex-col">
          <label class="mb-1">Количество</label>
          <input
            v-model="addQty"
            type="number"
            step="0.01"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-24 text-right"
          />
        </div>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
          :disabled="loadingAdd"
          @click="addToStock"
        >
          Добавить на склад
        </button>
        <div class="text-xs text-slate-400">
          Поиск идёт по артикулу и по названию среди товаров общей базы.
        </div>
      </div>
      <div v-if="addHint" class="text-xs text-slate-400 mt-1">
        {{ addHint }}
      </div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
      <div class="text-sm text-slate-200 mb-1">Распознать список товаров (OCR)</div>
      <div class="flex flex-wrap gap-3 items-center text-xs text-slate-300">
        <label class="inline-flex items-center px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm cursor-pointer hover:bg-slate-800">
          <input
            ref="ocrFileInput"
            type="file"
            multiple
            accept="image/*,application/pdf"
            capture="environment"
            class="hidden"
            @change="onOcrFileChange"
          />
          <span>⬆ Загрузить фото / скан</span>
        </label>
        <div class="text-xs text-slate-400">
          Поддерживаются изображения (JPG/PNG) и PDF-файлы, в том числе сделанные с камеры смартфона или ноутбука.
        </div>
      </div>
      <div v-if="ocrError" class="text-xs text-red-400">{{ ocrError }}</div>
      <div v-if="ocrLoading" class="text-xs text-slate-400">Распознаём текст...</div>
      <textarea
        v-model="ocrText"
        rows="5"
        class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        placeholder="Распознанный текст списка товаров появится здесь. Каждая строка должна содержать название и в конце количество."
      ></textarea>
      <button
        type="button"
        class="px-3 py-1.5 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
        :disabled="addingFromText || !ocrText.trim()"
        @click="addFromText"
      >
        Добавить на склад из текста
      </button>
      <div v-if="ocrHint" class="text-xs text-slate-400 mt-1">
        {{ ocrHint }}
      </div>
      <div v-if="ocrStats" class="text-xs text-slate-400 whitespace-pre-wrap">
        {{ ocrStats }}
      </div>
    </div>

    <div v-if="error" class="text-sm text-red-400">
      {{ error }}
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <div class="flex items-center justify-between px-3 pt-3 pb-2 text-xs text-slate-300 gap-3 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span>Позиции склада</span>
          <input
            ref="searchInput"
            v-model="searchQuery"
            type="text"
            placeholder="Поиск по артикулу или названию"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[220px]"
          />
          <label class="inline-flex items-center gap-1 text-[11px] text-slate-300">
            <input type="checkbox" v-model="onlyLowStock" />
            <span>Только мало</span>
          </label>
          <label class="inline-flex items-center gap-1 text-[11px] text-slate-300">
            <input type="checkbox" v-model="onlyZeroOrNegative" />
            <span>0 / минус</span>
          </label>
          <div class="flex items-center gap-1 text-[11px] text-slate-300">
            <span>Порог:</span>
            <input
              v-model.number="lowStockThreshold"
              type="number"
              step="0.01"
              class="w-16 bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-right"
            />
          </div>
          <label class="inline-flex items-center gap-1 text-[11px] text-slate-300">
            <input type="checkbox" v-model="inventoryMode" />
            <span>Инвентаризация</span>
          </label>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-2 py-1 rounded border border-slate-700 text-slate-200 hover:bg-slate-900 disabled:opacity-60 text-xs"
            :disabled="loading || sortedRows.length === 0"
            @click="exportStockCsv"
          >
            Экспорт CSV
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded border border-sky-700 text-sky-200 hover:bg-sky-950/40 disabled:opacity-60 text-xs"
            :disabled="selectedIds.length === 0 || loading || bulkRunning"
            @click="bulkUpdatePrices"
          >
            Массово цены
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded border border-emerald-700 text-emerald-200 hover:bg-emerald-950/40 disabled:opacity-60 text-xs"
            :disabled="selectedIds.length === 0 || loading || bulkRunning"
            @click="bulkMove('in')"
          >
            Приход выбранных
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded border border-red-700 text-red-200 hover:bg-red-950/40 disabled:opacity-60 text-xs"
            :disabled="selectedIds.length === 0 || loading || bulkRunning"
            @click="bulkMove('out')"
          >
            Списание выбранных
          </button>
          <button
            type="button"
            class="px-2 py-1 rounded border border-red-700 text-red-300 hover:bg-red-900 disabled:opacity-60 text-xs"
            :disabled="selectedIds.length === 0 || loading || bulkRunning"
            @click="deleteSelected"
          >
            Удалить выбранные
          </button>
        </div>
      </div>
      <div class="px-3 pb-2 text-[11px] text-slate-400 flex items-center justify-between gap-3 flex-wrap">
        <div>
          Всего: {{ summary.totalRows }};
          Отфильтровано: {{ summary.filteredRows }};
          Остаток (сумма): {{ formatQty(summary.totalQty) }};
          Мало: {{ summary.lowCount }};
          0/минус: {{ summary.zeroOrNegativeCount }}
        </div>
        <div>
          Стоимость (продажа): {{ formatMoney(summary.totalSaleValue) }};
          Приход (нал): {{ formatMoney(summary.totalPurchaseCashValue) }};
          Приход (безнал): {{ formatMoney(summary.totalPurchaseCashlessValue) }}
        </div>
        <div class="text-slate-500">
          Подсказки: Ctrl+F — поиск, Ctrl+R — обновить
        </div>
      </div>

      <div v-if="bulkRunning" class="px-3 pb-3 text-[11px] text-slate-300 space-y-1">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            {{ bulkLabel }}: {{ bulkDone }} / {{ bulkTotal }}
            <span v-if="bulkErrors.length" class="text-red-300">(ошибок: {{ bulkErrors.length }})</span>
          </div>
          <button
            type="button"
            class="px-2 py-1 rounded border border-slate-700 text-slate-200 hover:bg-slate-900 text-xs"
            @click="bulkCancelRequested = true"
          >
            Остановить
          </button>
        </div>
        <div class="w-full h-2 bg-slate-900 border border-slate-800 rounded overflow-hidden">
          <div
            class="h-full bg-emerald-600"
            :style="{ width: bulkTotal ? ((bulkDone / bulkTotal) * 100).toFixed(0) + '%' : '0%' }"
          ></div>
        </div>
        <div v-if="bulkErrors.length" class="text-[10px] text-slate-400 whitespace-pre-wrap">
          {{ bulkErrors.slice(0, 5).join('\n') }}
        </div>
      </div>

      <div v-if="inventoryMode" class="px-3 pb-3 text-[11px] text-slate-300 flex items-center justify-between gap-3 flex-wrap">
        <div>
          Инвентаризация: заполните «Факт», система посчитает «Δ». Затем нажмите «Применить инвентаризацию».
        </div>
        <button
          type="button"
          class="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-white disabled:opacity-60 text-xs"
          :disabled="loading || inventoryApplyDisabled"
          @click="applyInventory"
        >
          Применить инвентаризацию
        </button>
      </div>

      <table class="min-w-full text-sm">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-3 py-2 text-left">
              <input
                type="checkbox"
                :checked="allSelected"
                @change="toggleSelectAll($event)"
              />
            </th>
            <th class="px-3 py-2 text-left cursor-pointer select-none" @click="toggleSort('name')">
              Товар
              <span v-if="sortKey === 'name'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span>
            </th>
            <th class="px-3 py-2 text-left cursor-pointer select-none" @click="toggleSort('sku')">
              Артикул
              <span v-if="sortKey === 'sku'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span>
            </th>
            <th class="px-3 py-2 text-left cursor-pointer select-none" @click="toggleSort('unit')">
              Ед.
              <span v-if="sortKey === 'unit'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span>
            </th>
            <th class="px-3 py-2 text-right cursor-pointer select-none" @click="toggleSort('currentStock')">
              Остаток
              <span v-if="sortKey === 'currentStock'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span>
            </th>
            <th v-if="inventoryMode" class="px-3 py-2 text-right">Факт</th>
            <th v-if="inventoryMode" class="px-3 py-2 text-right">Δ</th>
            <th class="px-3 py-2 text-right">Приход нал</th>
            <th class="px-3 py-2 text-right">Приход безнал</th>
            <th class="px-3 py-2 text-right">Цена продажи</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in sortedRows"
            :key="row.id"
            class="border-t border-slate-800"
            :class="rowClass(row)"
          >
            <td class="px-3 py-2">
              <input
                type="checkbox"
                :value="row.id"
                v-model="selectedIds"
              />
            </td>
            <td class="px-3 py-2">{{ row.name }}</td>
            <td class="px-3 py-2 text-slate-300">{{ row.sku || '—' }}</td>
            <td class="px-3 py-2">{{ row.unit }}</td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="row.currentStock"
                type="number"
                step="0.01"
                class="w-20 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right text-xs"
                @blur="saveRow(row)"
              />
            </td>
            <td v-if="inventoryMode" class="px-3 py-2 text-right">
              <input
                v-model.number="row.actualStock"
                type="number"
                step="0.01"
                class="w-20 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right text-xs"
              />
            </td>
            <td v-if="inventoryMode" class="px-3 py-2 text-right" :class="deltaClass(row)">
              {{ formatQty(inventoryDelta(row)) }}
            </td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="row.purchasePriceCash"
                type="number"
                step="0.01"
                class="w-24 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right text-xs"
                @blur="saveRow(row)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="row.purchasePriceCashless"
                type="number"
                step="0.01"
                class="w-24 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right text-xs"
                @blur="saveRow(row)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="row.salePrice"
                type="number"
                step="0.01"
                class="w-24 bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right text-xs"
                @blur="saveRow(row)"
              />
            </td>
            <td class="px-3 py-2 text-right space-x-1">
              <button
                type="button"
                class="px-2 py-1 text-xs rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                @click="moveStock(row, 'in')"
              >
                Приход
              </button>
              <button
                type="button"
                class="px-2 py-1 text-xs rounded bg-red-600 hover:bg-red-500 text-white"
                @click="moveStock(row, 'out')"
              >
                Списание
              </button>
            </td>
          </tr>
          <tr v-if="!loading && sortedRows.length === 0">
            <td :colspan="inventoryMode ? 10 : 8" class="px-3 py-4 text-center text-slate-400">
              Нет позиций, измените фильтр или добавьте товары на склад.
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="px-3 py-3 text-sm text-slate-400">
        Загрузка данных склада...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import axios from 'axios';

interface StockRow {
  id: string;
  productId: string;
  name: string;
  sku?: string | null;
  unit: string;
  currentStock: number;
  initialStock: number;
  actualStock?: number | null;
  purchasePriceCash: number | null;
  purchasePriceCashless: number | null;
  salePrice: number | null;
}

const rows = ref<StockRow[]>([]);
const loading = ref(false);
const error = ref('');
const loadingAdd = ref(false);
const addQuery = ref('');
const addQty = ref('1');
const addHint = ref('');

const searchQuery = ref('');
const onlyLowStock = ref(false);
const onlyZeroOrNegative = ref(false);
const lowStockThreshold = ref<number>(5);
const inventoryMode = ref(false);

const bulkRunning = ref(false);
const bulkLabel = ref('');
const bulkDone = ref(0);
const bulkTotal = ref(0);
const bulkErrors = ref<string[]>([]);
const bulkCancelRequested = ref(false);

const sortKey = ref<'name' | 'sku' | 'unit' | 'currentStock'>('name');
const sortDir = ref<'asc' | 'desc'>('asc');

const UI_STORAGE_KEY = 'globalsnab_stock_ui_v1';
const searchInput = ref<HTMLInputElement | null>(null);

interface ProductLight {
  _id: string;
  name: string;
  sku?: string | null;
  unit: string;
  purchasePriceCash?: number | null;
  purchasePriceCashless?: number | null;
  lastSalePrice?: number | null;
}

const allProducts = ref<ProductLight[]>([]);

const ocrFileInput = ref<HTMLInputElement | null>(null);
const ocrLoading = ref(false);
const ocrError = ref('');
const ocrText = ref('');
const addingFromText = ref(false);
const ocrHint = ref('');
const ocrStats = ref('');

const selectedIds = ref<string[]>([]);

const loadStock = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/v1/warehouse');
    const items = res.data.items || [];
    rows.value = items
      .filter((it: any) => it.product)
      .map((it: any) => {
        const p = it.product;
        const purchaseCash = p.purchasePriceCash ?? null;
        const purchaseCashless = p.purchasePriceCashless ?? null;
        const sale = p.lastSalePrice ?? null;
        const qty = Number(it.currentStock) || 0;
        return {
          id: it._id,
          productId: p._id,
          name: p.name,
          sku: p.sku ?? null,
          unit: p.unit,
          currentStock: qty,
          initialStock: qty,
          purchasePriceCash: purchaseCash,
          purchasePriceCashless: purchaseCashless,
          salePrice: sale,
        } as StockRow;
      });
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки данных склада';
  } finally {
    loading.value = false;
  }
};

const loadUiState = () => {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    searchQuery.value = String(parsed.searchQuery || '');
    onlyLowStock.value = Boolean(parsed.onlyLowStock);
    onlyZeroOrNegative.value = Boolean(parsed.onlyZeroOrNegative);
    inventoryMode.value = Boolean(parsed.inventoryMode);
    const thr = Number(parsed.lowStockThreshold);
    if (Number.isFinite(thr) && thr >= 0) lowStockThreshold.value = thr;
    const sk = String(parsed.sortKey || 'name') as any;
    if (sk === 'name' || sk === 'sku' || sk === 'unit' || sk === 'currentStock') sortKey.value = sk;
    const sd = String(parsed.sortDir || 'asc');
    if (sd === 'asc' || sd === 'desc') sortDir.value = sd;
  } catch {
    // ignore
  }
};

const persistUiState = () => {
  try {
    localStorage.setItem(
      UI_STORAGE_KEY,
      JSON.stringify({
        searchQuery: searchQuery.value,
        onlyLowStock: onlyLowStock.value,
        onlyZeroOrNegative: onlyZeroOrNegative.value,
        lowStockThreshold: lowStockThreshold.value,
        inventoryMode: inventoryMode.value,
        sortKey: sortKey.value,
        sortDir: sortDir.value,
      }),
    );
  } catch {
    // ignore
  }
};

const onKeyDown = (e: KeyboardEvent) => {
  const key = (e.key || '').toLowerCase();
  if (!e.ctrlKey) return;

  if (key === 'f') {
    e.preventDefault();
    nextTick(() => {
      searchInput.value?.focus();
      searchInput.value?.select?.();
    });
  }

  if (key === 'r') {
    e.preventDefault();
    loadStock();
  }
};

const filteredRows = computed<StockRow[]>(() => {
  const q = searchQuery.value.trim().toLowerCase();
  let list = rows.value;

  if (q) {
    list = list.filter((row) => {
      const name = (row.name || '').toLowerCase();
      const sku = (row.sku || '').toLowerCase();
      return name.includes(q) || sku.includes(q);
    });
  }

  if (onlyLowStock.value) {
    const thr = Number(lowStockThreshold.value) || 0;
    list = list.filter((r) => Number(r.currentStock) <= thr);
  }

  if (onlyZeroOrNegative.value) {
    list = list.filter((r) => Number(r.currentStock) <= 0);
  }

  return list;
});

const sortedRows = computed<StockRow[]>(() => {
  const key = sortKey.value;
  const dir = sortDir.value;
  const list = [...filteredRows.value];

  list.sort((a, b) => {
    let av: any = (a as any)[key];
    let bv: any = (b as any)[key];

    if (key === 'currentStock') {
      av = Number(av) || 0;
      bv = Number(bv) || 0;
    } else {
      av = String(av || '').toLowerCase();
      bv = String(bv || '').toLowerCase();
    }

    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });

  return list;
});

const allSelected = computed(() => {
  const current = sortedRows.value;
  if (current.length === 0) return false;
  return current.every((r) => selectedIds.value.includes(r.id));
});

const toggleSelectAll = (event: Event) => {
  const checked = (event.target as HTMLInputElement).checked;
  const current = sortedRows.value;
  if (checked) {
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...current.map((r) => r.id)]));
  } else {
    const idsToRemove = new Set(current.map((r) => r.id));
    selectedIds.value = selectedIds.value.filter((id) => !idsToRemove.has(id));
  }
};

const toggleSort = (key: 'name' | 'sku' | 'unit' | 'currentStock') => {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = 'asc';
  }
};

const rowClass = (row: StockRow) => {
  const qty = Number(row.currentStock) || 0;
  const thr = Number(lowStockThreshold.value) || 0;
  if (qty < 0) return 'bg-red-950/30';
  if (qty === 0) return 'bg-red-950/15';
  if (qty <= thr) return 'bg-amber-950/15';
  return '';
};

const inventoryDelta = (row: StockRow) => {
  const fact = row.actualStock == null ? null : Number(row.actualStock);
  if (fact == null || Number.isNaN(fact)) return 0;
  const cur = Number(row.currentStock) || 0;
  return fact - cur;
};

const deltaClass = (row: StockRow) => {
  const d = inventoryDelta(row);
  if (d > 0) return 'text-emerald-300';
  if (d < 0) return 'text-red-300';
  return 'text-slate-400';
};

const inventoryChangedRows = computed(() => {
  if (!inventoryMode.value) return [] as StockRow[];
  return sortedRows.value.filter((r) => {
    const d = inventoryDelta(r);
    return Number.isFinite(d) && d !== 0;
  });
});

const inventoryApplyDisabled = computed(() => inventoryChangedRows.value.length === 0);

const applyInventory = async () => {
  if (!inventoryMode.value) return;
  const list = inventoryChangedRows.value;
  if (list.length === 0) return;

  const ok = window.confirm(`Применить инвентаризацию для позиций: ${list.length}?`);
  if (!ok) return;

  await runBulk('Инвентаризация', list, async (row) => {
    const d = inventoryDelta(row);
    if (!d) return;
    const type: 'in' | 'out' = d > 0 ? 'in' : 'out';
    const quantity = Math.abs(d);
    await axios.post(`/api/v1/warehouse/${row.productId}/move`, { type, quantity });
  });

  await loadStock();
};

const bulkMove = async (type: 'in' | 'out') => {
  if (selectedIds.value.length === 0) return;

  const label = type === 'in' ? 'прихода' : 'списания';
  const input = window.prompt(`Введите количество для ${label} (будет применено ко всем выбранным):`, '1');
  if (!input) return;
  const qty = Number(input.replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) {
    alert('Нужно ввести положительное число');
    return;
  }

  const ids = new Set(selectedIds.value);
  const targetRows = rows.value.filter((r) => ids.has(r.id));
  if (targetRows.length === 0) return;

  const ok = window.confirm(`Применить ${label} ${formatQty(qty)} к позициям: ${targetRows.length}?`);
  if (!ok) return;

  await runBulk(type === 'in' ? 'Массовый приход' : 'Массовое списание', targetRows, async (row) => {
    await axios.post(`/api/v1/warehouse/${row.productId}/move`, { type, quantity: qty });
  });

  await loadStock();
};

const exportStockCsv = () => {
  const list = sortedRows.value;
  if (!list.length) return;

  const header = [
    'sku',
    'name',
    'unit',
    'currentStock',
    'purchasePriceCash',
    'purchasePriceCashless',
    'salePrice',
  ];
  const rowsData = list.map((r) => [
    r.sku ?? '',
    r.name ?? '',
    r.unit ?? '',
    r.currentStock ?? 0,
    r.purchasePriceCash ?? '',
    r.purchasePriceCashless ?? '',
    r.salePrice ?? '',
  ]);

  const escape = (value: unknown) => {
    const s = String(value ?? '');
    if (s.includes('"') || s.includes(';') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csvLines = [header, ...rowsData].map((row) => row.map(escape).join(';'));
  const csvContent = '\uFEFF' + csvLines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `stock-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const deleteSelected = async () => {
  if (selectedIds.value.length === 0) return;
  if (!window.confirm('Удалить выбранные позиции склада? Это действие нельзя отменить.')) return;

  const ids = new Set(selectedIds.value);
  const targetRows = rows.value.filter((r) => ids.has(r.id));
  await runBulk('Удаление позиций склада', targetRows, async (row) => {
    await axios.delete(`/api/v1/warehouse/${row.id}`);
  });

  rows.value = rows.value.filter((r) => !ids.has(r.id));
  selectedIds.value = [];
};

const bulkUpdatePrices = async () => {
  if (selectedIds.value.length === 0) return;

  const cashStr = window.prompt('Новая цена прихода (нал), пусто = не менять:', '');
  if (cashStr === null) return;
  const cashlessStr = window.prompt('Новая цена прихода (безнал), пусто = не менять:', '');
  if (cashlessStr === null) return;
  const saleStr = window.prompt('Новая цена продажи, пусто = не менять:', '');
  if (saleStr === null) return;

  const parseOrNull = (s: string) => {
    const t = String(s || '').trim();
    if (!t) return null;
    const n = Number(t.replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const cash = parseOrNull(cashStr);
  const cashless = parseOrNull(cashlessStr);
  const sale = parseOrNull(saleStr);

  const payloadKeys = [cash != null, cashless != null, sale != null].filter(Boolean).length;
  if (payloadKeys === 0) return;

  const ids = new Set(selectedIds.value);
  const targetRows = rows.value.filter((r) => ids.has(r.id));
  if (targetRows.length === 0) return;

  await runBulk('Массовое изменение цен', targetRows, async (row) => {
    const payload: any = {};
    if (cash != null) payload.purchasePriceCash = cash;
    if (cashless != null) payload.purchasePriceCashless = cashless;
    if (sale != null) payload.lastSalePrice = sale;
    await axios.put(`/api/v1/products/${row.productId}`, payload);
  });

  await loadStock();
};

const runBulk = async <T extends { id?: string; productId?: string; name?: string }>(
  label: string,
  list: T[],
  handler: (item: T) => Promise<void>,
) => {
  if (!Array.isArray(list) || list.length === 0) return;

  bulkRunning.value = true;
  bulkLabel.value = label;
  bulkDone.value = 0;
  bulkTotal.value = list.length;
  bulkErrors.value = [];
  bulkCancelRequested.value = false;

  try {
    for (const item of list) {
      if (bulkCancelRequested.value) break;
      try {
        await handler(item);
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Ошибка операции';
        const name = (item as any)?.name ? ` (${String((item as any).name)})` : '';
        bulkErrors.value = [...bulkErrors.value, `${msg}${name}`];
      } finally {
        bulkDone.value += 1;
      }
    }
  } finally {
    bulkRunning.value = false;
  }
};

const saveRow = async (row: StockRow) => {
  const qty = Number(row.currentStock) || 0;
  const prev = Number(row.initialStock) || 0;
  const delta = qty - prev;

  const purchaseCash = row.purchasePriceCash != null ? Number(row.purchasePriceCash) : null;
  const purchaseCashless = row.purchasePriceCashless != null ? Number(row.purchasePriceCashless) : null;
  const sale = row.salePrice != null ? Number(row.salePrice) : null;

  try {
    // Обновление остатков через движение, если есть дельта
    if (delta !== 0) {
      const type: 'in' | 'out' = delta > 0 ? 'in' : 'out';
      const quantity = Math.abs(delta);
      await axios.post(`/api/v1/warehouse/${row.productId}/move`, { type, quantity });
      row.initialStock = qty;
    }

    // Обновление цен в карточке товара
    const pricePayload: any = {};
    if (purchaseCash != null && !Number.isNaN(purchaseCash)) {
      pricePayload.purchasePriceCash = purchaseCash;
    }
    if (purchaseCashless != null && !Number.isNaN(purchaseCashless)) {
      pricePayload.purchasePriceCashless = purchaseCashless;
    }
    if (sale != null && !Number.isNaN(sale)) {
      pricePayload.lastSalePrice = sale;
    }

    if (Object.keys(pricePayload).length > 0) {
      await axios.put(`/api/v1/products/${row.productId}`, pricePayload);
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка сохранения изменений по складу';
  }
};

const onOcrFileChange = async () => {
  const files = ocrFileInput.value?.files;
  if (!files || files.length === 0) return;

  ocrError.value = '';
  ocrHint.value = '';
  ocrStats.value = '';
  ocrLoading.value = true;

  try {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });

    const res = await axios.post('/api/v1/ocr/invoice', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = res.data || {};
    const text = data.rawTextForParsing || data.rawTextForDisplay || data.text || data.rawText || '';

    // Пытаемся сразу разобрать как накладную/счет и показать пользователю
    // упрощённый список "Название Кол-во" для быстрого добавления на склад.
    try {
      const parsed = await axios.post('/api/v1/ocr/parse', { rawText: String(text || '') });
      const draft = parsed.data?.draft;
      if (draft && Array.isArray(draft.items) && draft.items.length > 0) {
        ocrText.value = draft.items
          .filter((it: any) => {
            const name = String(it?.name || '').toLowerCase();
            return name && !name.includes('доставк');
          })
          .map((it: any) => `${String(it?.name || '').trim()} ${Number(it?.quantity) || 0}`)
          .filter((l: string) => l.trim() && !l.endsWith(' 0'))
          .join('\n');
      } else {
        ocrText.value = String(text || '');
      }
    } catch {
      ocrText.value = String(text || '');
    }
  } catch (e: any) {
    ocrError.value = e?.response?.data?.message || 'Ошибка OCR при распознавании списка товаров';
  } finally {
    ocrLoading.value = false;
    if (ocrFileInput.value) ocrFileInput.value.value = '';
  }
};

const addFromText = async () => {
  const text = ocrText.value;
  if (!text.trim()) return;

  addingFromText.value = true;
  ocrHint.value = '';
  ocrError.value = '';

  try {
    await ensureProductsLoaded();

    let items: { name: string; quantity: number }[] = [];

    try {
      const res = await axios.post('/api/v1/ocr/parse', { rawText: text });
      const draft = res.data?.draft;
      if (draft && Array.isArray(draft.items) && draft.items.length > 0) {
        items = draft.items
          .map((it: any) => ({
            name: String(it.name || ''),
            quantity: Number(it.quantity) || 0,
          }))
          .filter((it: { name: string; quantity: number }) => it.name && it.quantity > 0);
      }
    } catch {
      // если парсер накладной не сработал, упадём на построчную логику ниже
    }

    const isNoiseLine = (line: string) => {
      const l = String(line || '').toLowerCase();
      if (!l) return true;
      return (
        l.includes('инн') ||
        l.includes('кпп') ||
        l.includes('бик') ||
        l.includes('сч. №') ||
        l.includes('счет на оплату') ||
        l.includes('банк получателя') ||
        l.includes('получатель') ||
        l.includes('поставщик') ||
        l.includes('покупатель') ||
        l.includes('итого') ||
        l.includes('всего наименований') ||
        l.includes('руководитель') ||
        l.includes('бухгалтер')
      );
    };

    // Если backend не разобрал как накладную, используем простую построчную схему
    if (items.length === 0) {
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      for (const line of lines) {
        if (isNoiseLine(line)) continue;
        const m = line.match(/^(.*?)(\d+(?:[.,]\d+)?)\s*$/);
        if (!m) continue;
        const namePart = m[1].trim();
        const qtyStr = m[2].replace(',', '.');
        const qty = Number(qtyStr);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        if (isNoiseLine(namePart)) continue;
        items.push({ name: namePart, quantity: qty });
      }
    }

    // Оставляем только реальные товары, исключая строки вроде "Доставка"
    items = items.filter((it) => {
      const n = it.name.toLowerCase();
      return !n.includes('доставк');
    });

    const opErrors: string[] = [];

    const normalizeExactName = (name: string) => {
      return String(name || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[,.;:()"'«»]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const productsByName = new Map<string, ProductLight>();
    for (const p of allProducts.value) {
      const k = normalizeExactName(p.name);
      if (!k) continue;
      if (!productsByName.has(k)) productsByName.set(k, p);
    }

    // Если в общей базе вообще нет товаров, создаём новые товары по распознанному списку
    if (allProducts.value.length === 0 && items.length > 0) {
      let created = 0;

      for (const it of items) {
        try {
          const res = await axios.post('/api/v1/products', {
            name: it.name,
            unit: 'шт',
            isActive: true,
          });

          const product = res.data?.product;
          if (product && product._id) {
            const light: ProductLight = {
              _id: product._id,
              name: product.name,
              sku: product.sku ?? null,
              unit: product.unit || 'шт',
              purchasePriceCash: product.purchasePriceCash ?? null,
              purchasePriceCashless: product.purchasePriceCashless ?? null,
              lastSalePrice: product.lastSalePrice ?? null,
            };
            allProducts.value.push(light);

            await axios.post(`/api/v1/warehouse/${product._id}/move`, {
              type: 'in',
              quantity: it.quantity,
            });

            created += 1;
          }
        } catch (e: any) {
          const msg = e?.response?.data?.message || e?.message || 'Ошибка создания товара/прихода на склад';
          opErrors.push(`${msg}: ${it.name}`);
        }
      }

      if (created > 0) {
        await loadStock();
        ocrHint.value = `Создано новых товаров и добавлено на склад: ${created}.`;
        if (opErrors.length > 0) {
          ocrStats.value = opErrors.slice(0, 50).join('\n');
        }
        addingFromText.value = false;
        return;
      }

      // Ничего не создали: покажем причину, не выходим молча
      if (opErrors.length > 0) {
        ocrError.value = 'Не удалось добавить товары на склад. Проверь права доступа или ошибки ниже.';
        ocrStats.value = opErrors.slice(0, 50).join('\n');
      } else {
        ocrError.value = 'Не удалось добавить товары на склад (создано 0).';
      }
    }

    let added = 0;
    let notFound = 0;

    const notFoundItems: string[] = [];

    interface StatRow {
      product: ProductLight;
      quantity: number;
    }

    const statsMap = new Map<string, StatRow>();

    for (const it of items) {
      const key = normalizeExactName(it.name);
      let product = key ? productsByName.get(key) ?? null : null;

      // ВАЖНО: добавляем "как распознало":
      // ищем ТОЛЬКО точное совпадение по нормализованному имени.
      // Если нет — создаём новый товар.
      if (!product) {
        try {
          const res = await axios.post('/api/v1/products', {
            name: it.name,
            unit: 'шт',
            isActive: true,
          });

          const created = res.data?.product;
          if (created && created._id) {
            product = {
              _id: created._id,
              name: created.name,
              sku: created.sku ?? null,
              unit: created.unit || 'шт',
              purchasePriceCash: created.purchasePriceCash ?? null,
              purchasePriceCashless: created.purchasePriceCashless ?? null,
              lastSalePrice: created.lastSalePrice ?? null,
            };
            allProducts.value.push(product);
            const nk = normalizeExactName(product.name);
            if (nk) productsByName.set(nk, product);
          }
        } catch (e: any) {
          notFound += 1;
          notFoundItems.push(it.name);
          const msg = e?.response?.data?.message || e?.message || 'Ошибка создания товара';
          opErrors.push(`${msg}: ${it.name}`);
          continue;
        }
      }

      if (!product) {
        notFound += 1;
        notFoundItems.push(it.name);
        continue;
      }

      try {
        await axios.post(`/api/v1/warehouse/${product._id}/move`, { type: 'in', quantity: it.quantity });
      } catch (e: any) {
        const msg = e?.response?.data?.message || e?.message || 'Ошибка прихода на склад';
        opErrors.push(`${msg}: ${product.name}`);
        continue;
      }
      added += 1;

      const statKey = product._id;
      const prev = statsMap.get(statKey);
      if (prev) {
        prev.quantity += it.quantity;
      } else {
        statsMap.set(statKey, { product, quantity: it.quantity });
      }
    }

    if (added > 0) {
      await loadStock();
    }

    ocrHint.value = `Добавлено позиций: ${added}. Не найдено в базе: ${notFound}.`;
    if (opErrors.length > 0) {
      ocrError.value = 'Часть позиций не удалось добавить. Ошибки ниже.';
      ocrStats.value = opErrors.slice(0, 50).join('\n');
    }

    // Аналитика по текущему списку
    if (statsMap.size > 0) {
      let totalQty = 0;
      let totalSale = 0;
      let totalPurchaseCash = 0;

      const statsArray: StatRow[] = Array.from(statsMap.values());

      for (const s of statsArray) {
        totalQty += s.quantity;
        const salePrice = s.product.lastSalePrice != null ? Number(s.product.lastSalePrice) : 0;
        const purchaseCash = s.product.purchasePriceCash != null ? Number(s.product.purchasePriceCash) : 0;
        totalSale += salePrice * s.quantity;
        totalPurchaseCash += purchaseCash * s.quantity;
      }

      statsArray.sort((a, b) => b.quantity - a.quantity);
      const top = statsArray.slice(0, 5);

      const lines: string[] = [];
      lines.push(
        `Всего позиций: ${statsArray.length}. Всего штук: ${totalQty}. ` +
          `Сумма по продаже: ${formatMoney(totalSale)}. Сумма по приходу (нал): ${formatMoney(totalPurchaseCash)}.`,
      );
      if (top.length > 0) {
        lines.push(
          'Топ ходовых по количеству: ' +
            top
              .map((s) => `${s.product.sku || ''} ${s.product.name} — ${s.quantity}`.trim())
              .join('; '),
        );
      }
      if (notFoundItems.length > 0) {
        const uniqueMisses = Array.from(new Set(notFoundItems));
        const missesPreview = uniqueMisses.slice(0, 20).join('; ');
        lines.push('Не найдены в общей базе (' + notFoundItems.length + '): ' + missesPreview);
      }

      ocrStats.value = lines.join('\n');
    } else {
      if (notFoundItems.length > 0) {
        const uniqueMisses = Array.from(new Set(notFoundItems));
        const missesPreview = uniqueMisses.slice(0, 20).join('; ');
        ocrStats.value =
          'Не найдены в общей базе (' + notFoundItems.length + '): ' + missesPreview;
      } else {
        ocrStats.value = '';
      }
    }
  } catch (e: any) {
    ocrError.value = e?.response?.data?.message || 'Ошибка добавления на склад из текста';
  } finally {
    addingFromText.value = false;
  }
};

const formatMoney = (v: number | null) => {
  if (v == null || Number.isNaN(v)) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(v);
};

const formatQty = (v: number) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
};

const summary = computed(() => {
  const all = rows.value;
  const filtered = filteredRows.value;
  const thr = Number(lowStockThreshold.value) || 0;

  const totalQty = filtered.reduce((acc, r) => acc + (Number(r.currentStock) || 0), 0);
  const lowCount = filtered.filter((r) => (Number(r.currentStock) || 0) > 0 && (Number(r.currentStock) || 0) <= thr).length;
  const zeroOrNegativeCount = filtered.filter((r) => (Number(r.currentStock) || 0) <= 0).length;

  const totalSaleValue = filtered.reduce((acc, r) => {
    const qty = Number(r.currentStock) || 0;
    const price = r.salePrice == null ? null : Number(r.salePrice);
    if (!Number.isFinite(qty) || qty <= 0) return acc;
    if (price == null || !Number.isFinite(price) || price <= 0) return acc;
    return acc + qty * price;
  }, 0);

  const totalPurchaseCashValue = filtered.reduce((acc, r) => {
    const qty = Number(r.currentStock) || 0;
    const price = r.purchasePriceCash == null ? null : Number(r.purchasePriceCash);
    if (!Number.isFinite(qty) || qty <= 0) return acc;
    if (price == null || !Number.isFinite(price) || price <= 0) return acc;
    return acc + qty * price;
  }, 0);

  const totalPurchaseCashlessValue = filtered.reduce((acc, r) => {
    const qty = Number(r.currentStock) || 0;
    const price = r.purchasePriceCashless == null ? null : Number(r.purchasePriceCashless);
    if (!Number.isFinite(qty) || qty <= 0) return acc;
    if (price == null || !Number.isFinite(price) || price <= 0) return acc;
    return acc + qty * price;
  }, 0);

  return {
    totalRows: all.length,
    filteredRows: filtered.length,
    totalQty,
    lowCount,
    zeroOrNegativeCount,
    totalSaleValue,
    totalPurchaseCashValue,
    totalPurchaseCashlessValue,
  };
});

const ensureProductsLoaded = async () => {
  if (allProducts.value.length > 0) return;
  try {
    const res = await axios.get('/api/v1/products');
    const products = res.data.products || [];
    allProducts.value = products.map((p: any): ProductLight => ({
      _id: p._id,
      name: p.name,
      sku: p.sku ?? null,
      unit: p.unit,
      purchasePriceCash: p.purchasePriceCash ?? null,
      purchasePriceCashless: p.purchasePriceCashless ?? null,
      lastSalePrice: p.lastSalePrice ?? null,
    }));
  } catch (e) {
    // игнорируем, основное сообщение об ошибке будет в других местах
  }
};

const getNextSku = (): string => {
  const numericSkus = allProducts.value
    .map((p) => {
      const raw = String(p.sku || '').trim();
      const digits = raw.replace(/[^0-9]/g, '');
      const num = Number(digits);
      return Number.isFinite(num) ? num : null;
    })
    .filter((n): n is number => n !== null);

  const maxSku = numericSkus.length > 0 ? Math.max(...numericSkus) : 0;
  return String(maxSku + 1);
};

const addToStock = async () => {
  const q = addQuery.value.trim().toLowerCase();
  const rawQty = typeof addQty.value === 'number' ? String(addQty.value) : addQty.value;
  const qty = Number(String(rawQty).replace(',', '.'));
  addHint.value = '';

  if (!q) {
    addHint.value = 'Введите артикул или часть названия.';
    return;
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    addHint.value = 'Количество должно быть положительным числом.';
    return;
  }

  loadingAdd.value = true;

  try {
    await ensureProductsLoaded();

    const candidates = allProducts.value.filter((p) => {
      const sku = (p.sku || '').toLowerCase();
      const name = (p.name || '').toLowerCase();
      return sku.includes(q) || name.includes(q);
    });

    if (candidates.length === 0) {
      addHint.value = 'Товар не найден в общей базе.';
      return;
    }

    const product = candidates[0];
    addHint.value = candidates.length > 1 ? `Найдено несколько товаров, используется первый: ${product.sku || ''} ${product.name}` : `${product.sku || ''} ${product.name}`;

    await axios.post(`/api/v1/warehouse/${product._id}/move`, { type: 'in', quantity: qty });
    await loadStock();
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка добавления товара на склад';
  } finally {
    loadingAdd.value = false;
  }
};

const moveStock = async (row: StockRow, type: 'in' | 'out') => {
  const label = type === 'in' ? 'прихода' : 'списания';
  const input = window.prompt(`Введите количество для ${label} по товару "${row.name}":`, '1');
  if (!input) return;
  const qty = Number(input.replace(',', '.'));
  if (!Number.isFinite(qty) || qty <= 0) {
    alert('Нужно ввести положительное число');
    return;
  }

  try {
    await axios.post(`/api/v1/warehouse/${row.productId}/move`, { type, quantity: qty });
    await loadStock();
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка движения по складу';
  }
};

onMounted(() => {
  loadUiState();
  loadStock();
  ensureProductsLoaded();
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
});

watch([searchQuery, onlyLowStock, onlyZeroOrNegative, lowStockThreshold, sortKey, sortDir], () => {
  persistUiState();
});

watch(inventoryMode, (v) => {
  // При входе в режим инвентаризации заполняем факт текущими остатками для удобства
  if (v) {
    for (const r of rows.value) {
      r.actualStock = Number(r.currentStock) || 0;
    }
  }
  persistUiState();
});
</script>

<style scoped></style>
