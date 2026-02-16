<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <button type="button" @click="onPrint">Печать</button>
      <button type="button" @click="onBack">Назад</button>
    </div>

    <div v-if="loading" class="status">Загрузка накладной...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>

    <div v-else-if="invoice" class="sheet">
      <header class="sheet-header">
        <div class="logo">GlobalSnab</div>
        <div class="doc-title">
          <div class="doc-name">
            Накладная №
            <span>{{ invoice.number }}</span>
          </div>
          <div class="doc-date">
            от
            <span>{{ formatDate(invoice.date) }}</span>
          </div>
        </div>
      </header>

      <section class="hint no-print">
        Можно добавить комментарий перед печатью. Изменения используются только для печати и не сохраняются.
      </section>

      <section class="items">
        <table>
          <thead>
            <tr>
              <th class="col-index">№</th>
              <th class="col-name">Товар</th>
              <th class="col-qty">Кол-во</th>
              <th class="col-price">Цена прихода</th>
              <th class="col-amount">Сумма</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in draft.items" :key="idx">
              <td class="text-center">{{ idx + 1 }}</td>
              <td>
                <span class="print-only">{{ item.name }}</span>
                <input v-model="item.name" type="text" class="input wide no-print" />
              </td>
              <td class="text-right">
                <span class="print-only">{{ formatNumber(item.quantity) }}</span>
                <input v-model.number="item.quantity" type="number" step="1" class="input num no-print" />
              </td>
              <td class="text-right">
                <span class="print-only">{{ formatMoney(itemPurchasePrice(item)) }}</span>
                <input
                  v-if="invoice.paymentType === 'cash'"
                  v-model.number="item.purchasePriceCash"
                  type="number"
                  step="0.01"
                  class="input num no-print"
                />
                <input
                  v-else
                  v-model.number="item.purchasePriceCashless"
                  type="number"
                  step="0.01"
                  class="input num no-print"
                />
              </td>
              <td class="text-right">{{ formatMoney((Number(item.quantity) || 0) * itemPurchasePrice(item)) }}</td>
            </tr>

            <tr v-for="i in blankPrintRows" :key="`blank-${i}`" class="print-row">
              <td class="text-center">{{ draft.items.length + i }}</td>
              <td>&nbsp;</td>
              <td class="text-right">&nbsp;</td>
              <td class="text-right">&nbsp;</td>
              <td class="text-right">&nbsp;</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="table-controls no-print">
        <div class="table-controls-row">
          <button type="button" @click="addRow">Добавить строку</button>
          <button type="button" @click="incBlankPrintRows">+ пустая строка (печать)</button>
          <button type="button" :disabled="blankPrintRows <= 0" @click="decBlankPrintRows">- пустая строка</button>
          <span class="table-controls-info">Пустых строк на печать: {{ blankPrintRows }}</span>
        </div>
      </section>

      <section class="totals">
        <div class="totals-row">
          <span>Итого:</span>
          <span class="totals-value">{{ formatMoney(totalEdited) }} ₽</span>
        </div>
      </section>

      <section class="comment">
        <div class="label">Комментарий:</div>
        <div class="print-only comment-print">{{ draft.comment }}</div>
        <textarea v-model="draft.comment" class="comment-input no-print" rows="3"></textarea>
      </section>

      <section class="signatures">
        <div class="sign-line">
          <span>Отпустил ____________________</span>
        </div>
        <div class="sign-line">
          <span>Принял ____________________</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

interface InvoiceItem {
  name: string;
  sku?: string | null;
  product?: {
    sku?: string | null;
  } | null;
  unit: string;
  quantity: number;
  salePrice: number;
  purchasePriceCash?: number | null;
  purchasePriceCashless?: number | null;
}

interface InvoiceFull {
  _id: string;
  number: string;
  date: string;
  supplier: string;
  client: string;
  paymentType: 'cash' | 'cashless';
  totalAmount: number;
  deliveryPrice?: number;
  items: InvoiceItem[];
}

interface InvoiceDraft {
  comment: string;
  items: InvoiceItem[];
}

const route = useRoute();
const router = useRouter();

const invoice = ref<InvoiceFull | null>(null);
const draft = ref<InvoiceDraft>({
  comment: '',
  items: [],
});
const blankPrintRows = ref(0);
const loading = ref(false);
const error = ref('');

const formatDate = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('ru-RU');
};

const formatNumber = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

const formatMoney = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const totalEdited = computed(() => {
  const itemsTotal = (draft.value.items || []).reduce((acc, it) => {
    const qty = Number(it.quantity) || 0;
    const price = itemPurchasePrice(it);
    return acc + qty * price;
  }, 0);
  return itemsTotal;
});

const itemPurchasePrice = (it: InvoiceItem) => {
  const pt = invoice.value?.paymentType;
  if (pt === 'cash') {
    return Number(it.purchasePriceCash) || 0;
  }
  return Number(it.purchasePriceCashless) || 0;
};

const addRow = () => {
  const pt = invoice.value?.paymentType;
  draft.value.items.push({
    name: '',
    unit: 'шт',
    quantity: 1,
    salePrice: 0,
    purchasePriceCash: pt === 'cash' ? 0 : null,
    purchasePriceCashless: pt === 'cashless' ? 0 : null,
  });
};

const incBlankPrintRows = () => {
  blankPrintRows.value += 1;
};

const decBlankPrintRows = () => {
  blankPrintRows.value = Math.max(0, blankPrintRows.value - 1);
};

const loadInvoice = async () => {
  const id = route.params.id as string;
  if (!id) {
    error.value = 'Не указан идентификатор накладной';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get(`/api/v1/invoices/${id}`);
    invoice.value = res.data?.invoice as InvoiceFull;

    if (invoice.value) {
      draft.value = {
        comment: '',
        items: (invoice.value.items || []).map((it) => ({
          name: String(it.name || ''),
          sku: it.sku ?? null,
          product: it.product || null,
          unit: String(it.unit || 'шт'),
          quantity: Number(it.quantity) || 0,
          salePrice: Number(it.salePrice) || 0,
          purchasePriceCash: typeof it.purchasePriceCash === 'number' ? it.purchasePriceCash : (it.purchasePriceCash ?? null),
          purchasePriceCashless:
            typeof it.purchasePriceCashless === 'number' ? it.purchasePriceCashless : (it.purchasePriceCashless ?? null),
        })),
      };
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки накладной';
  } finally {
    loading.value = false;
  }
};

const onPrint = () => {
  window.print();
};

const onBack = () => {
  router.back();
};

onMounted(() => {
  loadInvoice();
});
</script>

<style scoped>
.print-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 16px;
  box-sizing: border-box;
}

.print-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-bottom: 12px;
}

.print-toolbar button {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: white;
  cursor: pointer;
}

.print-toolbar button:hover {
  background: #e5e7eb;
}

.sheet {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  padding: 24px 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #111827;
}

.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.logo {
  font-weight: 700;
  font-size: 20px;
}

.doc-title {
  text-align: right;
}

.doc-name {
  font-size: 18px;
  font-weight: 600;
}

.doc-date {
  font-size: 13px;
  color: #4b5563;
}

.hint {
  margin: 10px 0 14px;
  font-size: 12px;
  color: #6b7280;
}

.parties {
  font-size: 13px;
  margin-bottom: 16px;
}

.parties .label {
  font-weight: 600;
}

.parties .value {
  margin-left: 4px;
}

.items table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.table-controls {
  margin-top: 10px;
}

.table-controls-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.table-controls-info {
  font-size: 12px;
  color: #4b5563;
  margin-left: auto;
}

.items th,
.items td {
  border: 1px solid #d1d5db;
  padding: 4px 6px;
}

.items thead {
  background: #e5e7eb;
}

.col-index {
  width: 32px;
}

.col-name {
  width: 50%;
}

.col-unit {
  width: 50px;
}

.col-qty,
.col-price,
.col-amount {
  width: 90px;
}

.input {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 12px;
}

.input.wide {
  width: 100%;
}

.input.unit {
  width: 60px;
  text-align: center;
}

.input.num {
  width: 88px;
  text-align: right;
}

.print-only {
  display: none;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.totals {
  margin-top: 12px;
  font-size: 13px;
}

.comment {
  margin-top: 14px;
  font-size: 12px;
}

.comment-input {
  width: 100%;
  margin-top: 6px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 8px 10px;
  font-size: 12px;
  resize: vertical;
  box-sizing: border-box;
}

.comment-print {
  margin-top: 6px;
  white-space: pre-wrap;
}

.print-row {
  display: none;
}

.totals-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.totals-value {
  font-weight: 600;
}

.signatures {
  margin-top: 32px;
  font-size: 12px;
}

.sign-line {
  margin-top: 8px;
}

.status {
  max-width: 900px;
  margin: 40px auto;
  text-align: center;
  font-size: 14px;
}

.status.error {
  color: #b91c1c;
}

@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: inline !important;
  }

  .print-row {
    display: table-row !important;
  }

  .print-page {
    background: white;
    padding: 0;
  }

  .sheet {
    box-shadow: none;
    margin: 0;
    width: 100%;
    max-width: 100%;
  }
}
</style>
