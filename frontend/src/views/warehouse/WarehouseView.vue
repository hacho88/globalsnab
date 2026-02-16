<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Общая база товаров</h1>
      <div class="flex items-center gap-2">
        <label class="inline-flex items-center px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm cursor-pointer hover:bg-slate-800">
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            accept="application/json"
            @change="onFileChange"
          />
          <span>⬆ Импорт товаров (JSON)</span>
        </label>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-500 text-white disabled:opacity-60"
          :disabled="loading || products.length === 0 || deleting"
          @click="deleteAllProducts"
        >
          Удалить все товары
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-red-700 hover:bg-red-600 text-white disabled:opacity-60"
          :disabled="loading || selectedIds.length === 0 || deletingSelected"
          @click="deleteSelectedProducts"
        >
          Удалить выбранные
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-60"
          :disabled="loading || products.length === 0"
          @click="exportProducts"
        >
          Экспорт JSON
        </button>
        <button
          type="button"
          class="px-3 py-1.5 text-sm rounded bg-slate-700 hover:bg-slate-600 text-white disabled:opacity-60"
          :disabled="loading || products.length === 0"
          @click="exportProductsCsv"
        >
          Экспорт Excel (CSV)
        </button>
      </div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-wrap items-end gap-3 text-sm">
      <div class="flex flex-col min-w-[260px]">
        <label class="mb-1 text-slate-300">Быстро добавить товар</label>
        <input
          v-model="newProductName"
          type="text"
          placeholder="Название товара"
          class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      <button
        type="button"
        class="px-3 py-2 text-sm rounded bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60"
        :disabled="loading || creating || !newProductName.trim()"
        @click="createProduct"
      >
        Добавить товар (артикул авто)
      </button>
      <div v-if="createError" class="text-xs text-red-400">
        {{ createError }}
      </div>
    </div>

    <div class="flex items-center gap-3 mt-2 flex-wrap">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Поиск по названию или артикулу..."
        class="w-full max-w-md bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <label class="inline-flex items-center gap-1 text-xs text-slate-300">
        <input type="checkbox" v-model="showArchive" @change="onToggleArchive" />
        <span>Показать архив товаров</span>
      </label>
    </div>

    <div v-if="importMessage" class="text-sm text-emerald-400">
      {{ importMessage }}
    </div>
    <div v-if="error" class="text-sm text-red-400">
      {{ error }}
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-3 py-2 text-center w-8">
              <input
                type="checkbox"
                :checked="products.length > 0 && selectedIds.length === products.length"
                @change="toggleSelectAll($event)"
              />
            </th>
            <th class="px-3 py-2 text-left">Товар</th>
            <th class="px-3 py-2 text-left">Артикул</th>
            <th class="px-3 py-2 text-left">Ед.</th>
            <th class="px-3 py-2 text-right">Приход нал</th>
            <th class="px-3 py-2 text-right">Приход б/н</th>
            <th class="px-3 py-2 text-right">Цена продажи</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredProducts" :key="p._id" class="border-t border-slate-800">
            <td class="px-3 py-2 text-center">
              <input
                type="checkbox"
                :value="p._id"
                :checked="selectedIds.includes(p._id)"
                @change="toggleSelectOne(p._id, $event)"
              />
            </td>
            <td class="px-3 py-2">{{ p.name }}</td>
            <td class="px-3 py-2 text-slate-300">{{ p.sku || '—' }}</td>
            <td class="px-3 py-2">{{ p.unit }}</td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="p.purchasePriceCash"
                type="number"
                step="0.01"
                class="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                @blur="saveProduct(p)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="p.purchasePriceCashless"
                type="number"
                step="0.01"
                class="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                @blur="saveProduct(p)"
              />
            </td>
            <td class="px-3 py-2 text-right">
              <input
                v-model.number="p.lastSalePrice"
                type="number"
                step="0.01"
                class="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                @blur="saveProduct(p)"
              />
            </td>
          </tr>
          <tr v-if="!loading && filteredProducts.length === 0">
            <td colspan="7" class="px-3 py-4 text-center text-slate-400">
              Товары ещё не загружены. Импортируйте JSON или создайте первые позиции через API.
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="loading" class="px-3 py-3 text-sm text-slate-400">
        Загрузка товаров...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import axios from 'axios';

interface ProductDto {
  _id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  unit: string;
  purchasePriceCash?: number | null;
  purchasePriceCashless?: number | null;
  lastSalePrice?: number | null;
}

const products = ref<ProductDto[]>([]);
const archivedProducts = ref<ProductDto[]>([]);
const loading = ref(false);
const error = ref('');
const importMessage = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const savingId = ref<string | null>(null);
const deleting = ref(false);
const selectedIds = ref<string[]>([]);
const deletingSelected = ref(false);
const searchQuery = ref('');
const showArchive = ref(false);

const newProductName = ref('');
const creating = ref(false);
const createError = ref('');

const loadProducts = async () => {
  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get('/api/v1/products');
    products.value = res.data.products || [];
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки товаров';
  } finally {
    loading.value = false;
  }
};

const loadArchivedProducts = async () => {
  if (!showArchive.value) return;
  try {
    const res = await axios.get('/api/v1/products/archived');
    archivedProducts.value = res.data.products || [];
  } catch (e) {
    // архив вспомогательный, ошибки можно не показывать отдельно
  }
};

const filteredProducts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return products.value;

  return products.value.filter((p) => {
    const name = (p.name || '').toLowerCase();
    const sku = (p.sku || '').toString().toLowerCase();
    return name.includes(q) || sku.includes(q);
  });
});

const onFileChange = async () => {
  const file = fileInput.value?.files?.[0];
  if (!file) return;

  error.value = '';
  importMessage.value = '';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('format', 'json');

  try {
    const res = await axios.post('/api/v1/products/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    importMessage.value = `Импортировано товаров: ${res.data.imported}`;
    await loadProducts();
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка импорта товаров';
  } finally {
    if (fileInput.value) fileInput.value.value = '';
  }
};

const formatPrice = (v?: number | null) => {
  if (v == null) return '—';
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(v);
};

const saveProduct = async (p: ProductDto) => {
  if (!p._id) return;

  savingId.value = p._id;
  error.value = '';

  try {
    await axios.put(`/api/v1/products/${p._id}`, {
      purchasePriceCash: p.purchasePriceCash ?? null,
      purchasePriceCashless: p.purchasePriceCashless ?? null,
      lastSalePrice: p.lastSalePrice ?? null,
    });
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка сохранения товара';
  } finally {
    savingId.value = null;
  }
};

const deleteAllProducts = async () => {
  if (products.value.length === 0) return;
  const ok = window.confirm('Удалить все товары? Это действие нельзя отменить.');
  if (!ok) return;

  deleting.value = true;
  error.value = '';

  try {
    await axios.delete('/api/v1/products/all');
    products.value = [];
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка удаления товаров';
  } finally {
    deleting.value = false;
  }
};

const toggleSelectAll = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    selectedIds.value = products.value.map((p) => p._id);
  } else {
    selectedIds.value = [];
  }
};

const toggleSelectOne = (id: string, event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value = [...selectedIds.value, id];
    }
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id);
  }
};

const deleteSelectedProducts = async () => {
  if (selectedIds.value.length === 0) return;
  const ok = window.confirm(`Удалить выбранные товары (${selectedIds.value.length} шт.)?`);
  if (!ok) return;

  deletingSelected.value = true;
  error.value = '';

  try {
    await axios.post('/api/v1/products/bulk-delete', { ids: selectedIds.value });
    products.value = products.value.filter((p) => !selectedIds.value.includes(p._id));
    selectedIds.value = [];
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка удаления выбранных товаров';
  } finally {
    deletingSelected.value = false;
  }
};

const restoreProduct = async (id: string) => {
  try {
    await axios.put(`/api/v1/products/${id}`, { isActive: true });
    await Promise.all([loadProducts(), loadArchivedProducts()]);
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка восстановления товара';
  }
};

const exportProducts = () => {
  if (!products.value.length) return;

  const data = products.value.map((p) => ({
    _id: p._id,
    name: p.name,
    sku: p.sku ?? null,
    unit: p.unit,
    purchasePriceCash: p.purchasePriceCash ?? null,
    purchasePriceCashless: p.purchasePriceCashless ?? null,
    lastSalePrice: p.lastSalePrice ?? null,
  }));

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `products-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const onToggleArchive = async () => {
  if (showArchive.value) {
    await loadArchivedProducts();
  }
};

const createProduct = async () => {
  const name = newProductName.value.trim();
  if (!name) return;

  createError.value = '';
  creating.value = true;

  try {
    // Находим максимальный числовой артикул среди существующих
    let maxNum = 0;
    for (const p of products.value) {
      const raw = (p.sku ?? '').toString().trim();
      if (!raw) continue;
      const digits = raw.replace(/[^0-9]/g, '');
      if (!digits) continue;
      const num = parseInt(digits, 10);
      if (Number.isFinite(num) && num > maxNum) {
        maxNum = num;
      }
    }

    const nextNum = maxNum + 1;
    const nextSku = nextNum.toString().padStart(4, '0');

    const res = await axios.post('/api/v1/products', {
      name,
      sku: nextSku,
      unit: 'шт',
      isActive: true,
    });

    const created: ProductDto | undefined = res.data?.product;
    if (created) {
      products.value = [...products.value, created];
      newProductName.value = '';
    } else {
      await loadProducts();
    }
  } catch (e: any) {
    createError.value = e?.response?.data?.message || 'Ошибка добавления товара';
  } finally {
    creating.value = false;
  }
};

const exportProductsCsv = () => {
  if (!products.value.length) return;

  const header = ['sku', 'name', 'unit', 'purchasePriceCash', 'purchasePriceCashless', 'lastSalePrice'];

  const rows = products.value.map((p) => [
    p.sku ?? '',
    p.name ?? '',
    p.unit ?? '',
    p.purchasePriceCash ?? '',
    p.purchasePriceCashless ?? '',
    p.lastSalePrice ?? '',
  ]);

  const escape = (value: unknown) => {
    const s = String(value ?? '');
    if (s.includes('"') || s.includes(';') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };

  const csvLines = [header, ...rows].map((row) => row.map(escape).join(';'));
  const csvContent = '\uFEFF' + csvLines.join('\n'); // BOM для корректного UTF-8 в Excel

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `products-${date}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

onMounted(() => {
  loadProducts();
});
</script>

<style scoped></style>
