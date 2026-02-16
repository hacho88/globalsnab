<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">Товарные чеки</h1>

    <!-- Шапка чека -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Номер чека</label>
          <input
            v-model="draft.number"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Дата</label>
          <input
            v-model="draft.date"
            type="datetime-local"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Комментарий</label>
          <input
            v-model="draft.comment"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Название магазина</label>
          <input
            v-model="draft.shopName"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Адрес</label>
          <input
            v-model="draft.shopAddress"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Контакты</label>
          <input
            v-model="draft.shopContacts"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">ИНН покупателя</label>
          <div class="flex gap-2">
            <input
              v-model="buyerInn"
              type="text"
              maxlength="12"
              class="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            />
            <button
              type="button"
              class="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-[11px] text-white disabled:opacity-60"
              :disabled="lookupLoading || !buyerInn"
              @click="lookupBuyerByInn"
            >
              {{ lookupLoading ? 'Поиск...' : 'По ИНН' }}
            </button>
          </div>
          <div v-if="lookupError" class="text-[11px] text-red-400 mt-1">{{ lookupError }}</div>
          <div v-if="buyerName" class="text-[11px] text-slate-300 mt-1 truncate" :title="buyerName">
            {{ buyerName }}
          </div>
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Название покупателя</label>
          <input
            v-model="buyerName"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Адрес покупателя</label>
          <input
            v-model="buyerAddress"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <!-- Позиции чека -->
      <div class="mt-3 border border-slate-800 rounded-lg overflow-hidden">
        <datalist id="check-sku-list">
          <option v-for="p in products" :key="p._id" :value="p.sku || ''">{{ p.name }}</option>
        </datalist>
        <datalist id="check-name-list">
          <option v-for="p in products" :key="p._id" :value="p.name">{{ p.sku || '' }}</option>
        </datalist>
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left w-[32px]">№</th>
              <th class="px-2 py-1 text-left w-[100px]">Артикул</th>
              <th class="px-2 py-1 text-left">Наименование</th>
              <th class="px-2 py-1 text-right w-[72px]">Кол-во</th>
              <th class="px-2 py-1 text-right w-[96px]">Цена</th>
              <th class="px-2 py-1 text-right w-[96px]">Сумма</th>
              <th class="px-2 py-1 text-right w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, idx) in draft.items"
              :key="idx"
              class="border-t border-slate-800"
            >
              <td class="px-2 py-1">{{ idx + 1 }}</td>
              <td class="px-2 py-1">
                <input
                  v-model="item.sku"
                  type="text"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5"
                  list="check-sku-list"
                  :data-row="idx"
                  data-field="sku"
                  @change="fillItemFromSku(item, idx)"
                  @blur="fillItemFromSku(item, idx)"
                  @keydown.enter.prevent="focusRowField(idx, 'qty')"
                />
              </td>
              <td class="px-2 py-1">
                <input
                  v-model="item.name"
                  type="text"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5"
                  :data-row="idx"
                  data-field="name"
                  list="check-name-list"
                  @change="fillItemFromName(item, idx)"
                  @keydown.enter.prevent="focusRowField(idx, 'qty')"
                />
              </td>
              <td class="px-2 py-1 text-right">
                <input
                  v-model.number="item.quantity"
                  type="number"
                  min="0"
                  step="1"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                  :data-row="idx"
                  data-field="qty"
                  @input="recomputeItemAmount(item, idx)"
                  @keydown.enter.prevent="focusRowField(idx, 'price')"
                />
              </td>
              <td class="px-2 py-1 text-right">
                <input
                  v-model.number="item.price"
                  type="number"
                  min="0"
                  step="1"
                  class="w-full bg-slate-900 border border-slate-800 rounded px-1 py-0.5 text-right"
                  :data-row="idx"
                  data-field="price"
                  @input="recomputeItemAmount(item, idx)"
                  @keydown.enter.prevent="handleRowEnter(idx)"
                />
              </td>
              <td class="px-2 py-1 text-right">
                {{ formatMoney(item.amount) }}
              </td>
              <td class="px-2 py-1 text-right">
                <button
                  type="button"
                  class="px-1 py-0.5 rounded bg-red-700 hover:bg-red-600 text-[10px] text-white"
                  @click="removeItem(idx)"
                >
                  ✕
                </button>
              </td>
            </tr>
            <tr v-if="!draft.items.length">
              <td colspan="7" class="px-2 py-3 text-center text-slate-400">
                Добавьте строки чека кнопкой ниже.
              </td>
            </tr>
          </tbody>
          <tfoot v-if="draft.items.length">
            <tr class="border-t border-slate-700 bg-slate-900/60">
              <td colspan="5" class="px-2 py-1 text-right font-medium">Итого:</td>
              <td class="px-2 py-1 text-right font-medium">{{ formatMoney(totalAmount) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div class="flex items-center justify-between mt-3">
        <div class="space-x-2">
          <button
            type="button"
            class="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white"
            @click="addEmptyItem"
          >
            Добавить строку
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60"
            :disabled="saveLoading || !draft.items.length"
            @click="saveCheck"
          >
            {{ saveLoading ? 'Сохранение...' : 'Сохранить чек' }}
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white"
            @click="resetDraft"
          >
            Новый чек
          </button>
          <button
            v-if="currentCheckId"
            type="button"
            class="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white"
            @click="goToPrint"
          >
            Печать
          </button>
        </div>
        <div class="text-right text-[11px]">
          <div v-if="saveError" class="text-red-400">{{ saveError }}</div>
          <div v-if="saveSuccess" class="text-emerald-400">Чек сохранён</div>
        </div>
      </div>
    </div>

    <!-- История чеков -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold text-sm">История чеков</div>
        <button
          type="button"
          class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] text-white disabled:opacity-60"
          :disabled="historyLoading"
          @click="loadHistory"
        >
          {{ historyLoading ? 'Обновление...' : 'Обновить' }}
        </button>
      </div>

      <div class="flex flex-wrap gap-2 items-end">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Поиск</label>
          <input
            v-model="historySearch"
            type="text"
            placeholder="№ / комментарий"
            class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Период с</label>
          <input
            v-model="historyFrom"
            type="date"
            class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">по</label>
          <input
            v-model="historyTo"
            type="date"
            class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          />
        </div>
      </div>

      <div v-if="historyError" class="text-xs text-red-400">{{ historyError }}</div>

      <div class="overflow-x-auto max-h-[320px] mt-2 border border-slate-800 rounded-lg">
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Дата</th>
              <th class="px-2 py-1 text-left">№</th>
              <th class="px-2 py-1 text-left">Комментарий</th>
              <th class="px-2 py-1 text-right">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in filteredChecks"
              :key="c._id"
              class="border-t border-slate-800 cursor-pointer hover:bg-slate-800/60"
              @click="loadCheckToDraft(c._id)"
            >
              <td class="px-2 py-1">{{ formatDate(c.date) }}</td>
              <td class="px-2 py-1">{{ c.number }}</td>
              <td class="px-2 py-1 truncate max-w-[160px]" :title="c.comment">{{ c.comment }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(c.totalAmount) }}</td>
            </tr>
            <tr v-if="!filteredChecks.length && !historyLoading">
              <td colspan="4" class="px-2 py-3 text-center text-slate-400">Чеки ещё не созданы.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="text-[11px] text-slate-300 mt-1">
        <div>Всего чеков: {{ filteredChecks.length }}</div>
        <div>Сумма по фильтру: {{ formatMoney(historyTotal) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

interface CheckItemDraft {
  sku: string;
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

interface CheckDraft {
  number: string;
  date: string;
  comment: string;
  shopName: string;
  shopAddress: string;
  shopContacts: string;
  items: CheckItemDraft[];
}

const todayLocal = () => new Date().toISOString().slice(0, 16);
const router = useRouter();

const DRAFT_STORAGE_KEY = 'globalsnab_checks_draft_v1';
const BUYER_STORAGE_KEY = 'globalsnab_checks_buyer_v1';

const draft = ref<CheckDraft>({
  number: '',
  date: todayLocal(),
  comment: '',
  shopName: '',
  shopAddress: '',
  shopContacts: '',
  items: [],
});

const currentCheckId = ref<string | null>(null);

const addEmptyItem = () => {
  draft.value.items.push({ sku: '', name: '', quantity: 1, price: 0, amount: 0 });
};

const recomputeItemAmount = (item: CheckItemDraft, idx?: number) => {
  const qty = Number(item.quantity) || 0;
  const price = Number(item.price) || 0;
  item.amount = qty * price;

  if (typeof idx === 'number') {
    const isLast = idx === draft.value.items.length - 1;
    const hasSomeData = Boolean((item.sku || '').trim() || (item.name || '').trim());
    if (isLast && hasSomeData) {
      const last = draft.value.items[draft.value.items.length - 1];
      if (last === item) {
        addEmptyItem();
      }
    }
  }
};

const removeItem = (idx: number) => {
  draft.value.items.splice(idx, 1);
};

const totalAmount = computed(() =>
  draft.value.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0),
);

// Локальная база товаров для автозаполнения по артикулу
interface ProductLight {
  _id: string;
  sku?: string | null;
  name: string;
  lastSalePrice?: number | null;
}

const products = ref<ProductLight[]>([]);

const skuIndex = ref<Map<string, ProductLight>>(new Map());
const nameIndex = ref<Map<string, ProductLight>>(new Map());

const loadProducts = async () => {
  try {
    const res = await axios.get('/api/v1/products');
    const list = res.data?.products || [];
    const normalized: ProductLight[] = list.map((p: any) => ({
      _id: p._id,
      sku: p.sku ?? null,
      name: String(p.name || ''),
      lastSalePrice: typeof p.lastSalePrice === 'number' ? p.lastSalePrice : null,
    }));

    products.value = normalized;

    const skuMap = new Map<string, ProductLight>();
    const nameMap = new Map<string, ProductLight>();

    for (const p of normalized) {
      const skuNorm = String(p.sku || '')
        .trim()
        .replace(/\s+/g, '')
        .toLowerCase();
      if (skuNorm) {
        skuMap.set(skuNorm, p);
      }
      const nameNorm = String(p.name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      if (nameNorm) {
        nameMap.set(nameNorm, p);
      }
    }

    skuIndex.value = skuMap;
    nameIndex.value = nameMap;
  } catch {
    products.value = [];
    skuIndex.value = new Map();
    nameIndex.value = new Map();
  }
};

const fillItemFromSku = (item: CheckItemDraft, idx?: number) => {
  const raw = (item.sku || '').trim();
  if (!raw || !skuIndex.value.size) return;
  const norm = raw.replace(/\s+/g, '').toLowerCase();
  const found = skuIndex.value.get(norm);
  if (!found) return;

  let changed = false;

  if (!item.name) {
    item.name = found.name;
    changed = true;
  }

  if (!item.price || Number.isNaN(item.price)) {
    const price = typeof found.lastSalePrice === 'number' ? found.lastSalePrice : 0;
    item.price = price;
    changed = true;
  }

  if (!item.quantity) {
    item.quantity = 1;
    changed = true;
  }

  recomputeItemAmount(item);

  if (typeof idx === 'number') {
    if (changed) {
      nextTick(() => focusRowField(idx, 'qty'));
    }
  }
};

const fillItemFromName = (item: CheckItemDraft, idx?: number) => {
  const raw = (item.name || '').trim();
  if (!raw || !nameIndex.value.size) return;
  const norm = raw.replace(/\s+/g, ' ').toLowerCase();
  const found = nameIndex.value.get(norm);
  if (!found) return;

  let changed = false;

  if (!item.sku && found.sku) {
    item.sku = found.sku;
    changed = true;
  }

  if (!item.price || Number.isNaN(item.price)) {
    const price = typeof found.lastSalePrice === 'number' ? found.lastSalePrice : 0;
    item.price = price;
    changed = true;
  }

  if (!item.quantity) {
    item.quantity = 1;
    changed = true;
  }

  recomputeItemAmount(item);

  if (typeof idx === 'number') {
    if (changed) {
      nextTick(() => focusRowField(idx, 'qty'));
    }
  }
};

// Реквизиты покупателя (для заполнения по ИНН через DaData)
const buyerInn = ref('');
const buyerName = ref('');
const buyerAddress = ref('');
const lookupLoading = ref(false);
const lookupError = ref('');

const lookupBuyerByInn = async () => {
  const inn = buyerInn.value.trim();
  if (!inn) return;

  lookupLoading.value = true;
  lookupError.value = '';
  try {
    const res = await axios.get('/api/v1/checks/org-by-inn', { params: { inn } });
    const org = res.data?.org;
    if (!org) {
      lookupError.value = 'Организация с таким ИНН не найдена';
      return;
    }
    buyerName.value = org.name || '';
    buyerAddress.value = org.address || '';
  } catch (e: any) {
    lookupError.value = e?.response?.data?.message || 'Ошибка поиска по ИНН';
  } finally {
    lookupLoading.value = false;
  }
};

// История чеков
interface CheckSummaryDto {
  _id: string;
  number: string;
  date: string;
  comment?: string;
  totalAmount: number;
}

const checks = ref<CheckSummaryDto[]>([]);
const historyFrom = ref<string>('');
const historyTo = ref<string>('');
const historySearch = ref<string>('');
const historyLoading = ref(false);
const historyError = ref('');

const filteredChecks = computed(() => {
  const q = historySearch.value.trim().toLowerCase();
  if (!q) return checks.value;
  return checks.value.filter((c) => {
    const n = String(c.number || '').toLowerCase();
    const cm = String(c.comment || '').toLowerCase();
    return n.includes(q) || cm.includes(q);
  });
});

const historyTotal = computed(() =>
  filteredChecks.value.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0),
);

const formatDate = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('ru-RU');
};

const formatMoney = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const loadHistory = async () => {
  historyLoading.value = true;
  historyError.value = '';
  try {
    const params: any = {};
    if (historyFrom.value) params.from = historyFrom.value;
    if (historyTo.value) params.to = historyTo.value;
    const res = await axios.get('/api/v1/checks', { params });
    checks.value = (res.data?.checks || []) as CheckSummaryDto[];
  } catch (e: any) {
    historyError.value = e?.response?.data?.message || 'Ошибка загрузки истории чеков';
  } finally {
    historyLoading.value = false;
  }
};

const saveLoading = ref(false);
const saveError = ref('');
const saveSuccess = ref(false);

const resetDraft = () => {
  draft.value = {
    number: '',
    date: todayLocal(),
    comment: '',
    shopName: '',
    shopAddress: '',
    shopContacts: '',
    items: [],
  };
  saveError.value = '';
  saveSuccess.value = false;
  currentCheckId.value = null;
};

const saveCheck = async () => {
  if (!draft.value.items.length) return;

  saveLoading.value = true;
  saveError.value = '';
  saveSuccess.value = false;

  try {
    const payload: any = {
      number: draft.value.number || undefined,
      date: draft.value.date ? new Date(draft.value.date).toISOString() : undefined,
      comment: draft.value.comment || undefined,
      shopName: draft.value.shopName || undefined,
      shopAddress: draft.value.shopAddress || undefined,
      shopContacts: draft.value.shopContacts || undefined,
      items: draft.value.items.map((it) => ({
        sku: it.sku || undefined,
        name: it.name || '',
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
      })),
    };

    const res = await axios.post('/api/v1/checks', payload);
    if (res.status === 201) {
      saveSuccess.value = true;
      const saved = res.data?.check;
      if (saved) {
        if (saved.number) {
          draft.value.number = saved.number;
        }
        if (saved._id) {
          currentCheckId.value = saved._id as string;
        }
      }
      await loadHistory();
    } else {
      saveError.value = 'Ошибка при сохранении чека';
    }
  } catch (e: any) {
    saveError.value = e?.response?.data?.message || 'Ошибка при сохранении чека';
  } finally {
    saveLoading.value = false;
  }
};

const focusRowField = async (idx: number, field: 'sku' | 'name' | 'qty' | 'price') => {
  await nextTick();
  const el = document.querySelector(
    `input[data-row="${idx}"][data-field="${field}"]`,
  ) as HTMLInputElement | null;
  if (el) {
    el.focus();
    el.select?.();
  }
};

const handleRowEnter = async (idx: number) => {
  await nextTick();
  const isLast = idx === draft.value.items.length - 1;
  if (isLast) {
    const item = draft.value.items[idx];
    const hasSomeData = Boolean((item.sku || '').trim() || (item.name || '').trim());
    if (hasSomeData) {
      addEmptyItem();
      await focusRowField(idx + 1, 'sku');
      return;
    }
  }
  await focusRowField(idx + 1, 'sku');
};

const loadCheckToDraft = async (id: string) => {
  try {
    const res = await axios.get(`/api/v1/checks/${id}`);
    const c = res.data?.check;
    if (!c) return;
    draft.value = {
      number: c.number || '',
      date: c.date ? new Date(c.date).toISOString().slice(0, 16) : todayLocal(),
      comment: c.comment || '',
      shopName: c.shopName || '',
      shopAddress: c.shopAddress || '',
      shopContacts: c.shopContacts || '',
      items: (c.items || []).map((it: any) => ({
        sku: it.sku || '',
        name: it.name || '',
        quantity: Number(it.quantity) || 0,
        price: Number(it.price) || 0,
        amount: (Number(it.quantity) || 0) * (Number(it.price) || 0),
      })),
    };
    currentCheckId.value = c._id as string;
  } catch {
    // игнорируем ошибку загрузки конкретного чека
  }
};

const goToPrint = () => {
  if (!currentCheckId.value) return;
  router.push({ name: 'checkPrint', params: { id: currentCheckId.value } });
};

const loadDraftFromStorage = () => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        draft.value = {
          number: String(parsed.number || ''),
          date: String(parsed.date || todayLocal()),
          comment: String(parsed.comment || ''),
          shopName: String(parsed.shopName || ''),
          shopAddress: String(parsed.shopAddress || ''),
          shopContacts: String(parsed.shopContacts || ''),
          items: Array.isArray(parsed.items)
            ? parsed.items.map((it: any) => ({
                sku: String(it?.sku || ''),
                name: String(it?.name || ''),
                quantity: Number(it?.quantity || 0) || 0,
                price: Number(it?.price || 0) || 0,
                amount: (Number(it?.quantity || 0) || 0) * (Number(it?.price || 0) || 0),
              }))
            : [],
        };
      }
    }
  } catch {
    // ignore
  }
};

const loadBuyerFromStorage = () => {
  try {
    const raw = localStorage.getItem(BUYER_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    buyerInn.value = String(parsed.buyerInn || '');
    buyerName.value = String(parsed.buyerName || '');
    buyerAddress.value = String(parsed.buyerAddress || '');
  } catch {
    // ignore
  }
};

const persistDraftToStorage = () => {
  try {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        number: draft.value.number,
        date: draft.value.date,
        comment: draft.value.comment,
        shopName: draft.value.shopName,
        shopAddress: draft.value.shopAddress,
        shopContacts: draft.value.shopContacts,
        items: draft.value.items.map((it) => ({
          sku: it.sku,
          name: it.name,
          quantity: it.quantity,
          price: it.price,
        })),
      }),
    );
  } catch {
    // ignore
  }
};

const persistBuyerToStorage = () => {
  try {
    localStorage.setItem(
      BUYER_STORAGE_KEY,
      JSON.stringify({
        buyerInn: buyerInn.value,
        buyerName: buyerName.value,
        buyerAddress: buyerAddress.value,
      }),
    );
  } catch {
    // ignore
  }
};

const onKeyDown = (e: KeyboardEvent) => {
  const key = (e.key || '').toLowerCase();
  if (!e.ctrlKey) return;

  if (key === 's') {
    e.preventDefault();
    saveCheck();
  }

  if (key === 'n') {
    e.preventDefault();
    resetDraft();
    addEmptyItem();
    nextTick(() => focusRowField(0, 'sku'));
  }

  if (key === 'p') {
    if (!currentCheckId.value) return;
    e.preventDefault();
    goToPrint();
  }
};

onMounted(() => {
  loadDraftFromStorage();
  loadBuyerFromStorage();
  if (!draft.value.items.length) {
    addEmptyItem();
  }
  loadHistory();
  loadProducts();
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown);
});

watch(
  () => draft.value,
  () => {
    persistDraftToStorage();
  },
  { deep: true },
);

watch([buyerInn, buyerName, buyerAddress], () => {
  persistBuyerToStorage();
});
</script>
