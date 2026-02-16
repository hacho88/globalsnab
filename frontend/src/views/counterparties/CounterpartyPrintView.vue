<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <button type="button" @click="onPrint">Печать</button>
      <button type="button" @click="onBack">Назад</button>
    </div>

    <div v-if="loading" class="status">Загрузка...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>

    <div v-else class="sheet">
      <header class="sheet-header">
        <div class="logo">GlobalSnab</div>
        <div class="doc-title">
          <div class="doc-name">Отчёт по контрагенту</div>
          <div class="doc-date">
            <span>Период:</span>
            <input v-model="from" type="date" class="input" />
            <span>—</span>
            <input v-model="to" type="date" class="input" />
            <button type="button" class="btn" @click="loadReport">Обновить</button>
          </div>
        </div>
      </header>

      <section class="parties">
        <div class="row">
          <span class="label">Контрагент:</span>
          <input v-model="editableCounterpartyName" type="text" class="input wide" />
        </div>
        <div class="row">
          <span class="label">Телефон:</span>
          <input v-model="editableCounterpartyPhone" type="text" class="input wide" placeholder="(необязательно)" />
        </div>
      </section>

      <section class="summary">
        <div class="summary-grid">
          <div class="card">
            <div class="k">Закупка (нал)</div>
            <div class="v">{{ formatMoney(summary.totalPurchaseCash) }} ₽</div>
          </div>
          <div class="card">
            <div class="k">Закупка (безнал)</div>
            <div class="v">{{ formatMoney(summary.totalPurchaseCashless) }} ₽</div>
          </div>
          <div class="card">
            <div class="k">Продажи (ред.)</div>
            <div class="v">{{ formatMoney(summaryComputed.totalSale) }} ₽</div>
          </div>
          <div class="card">
            <div class="k">Прибыль (ред.)</div>
            <div class="v">{{ formatMoney(summaryComputed.totalIncome) }} ₽</div>
          </div>
        </div>
        <div class="hint no-print">
          Можно менять цену продажи за единицу. Изменения используются только для печати и не сохраняются в базе.
        </div>
      </section>

      <section class="items">
        <table>
          <thead>
            <tr>
              <th class="col-index">№</th>
              <th class="col-name">Товар</th>
              <th class="col-unit">Ед.</th>
              <th class="col-qty">Кол-во</th>
              <th class="col-price">Цена продажи (ред.)</th>
              <th class="col-amount">Продажи (ред.)</th>
              <th class="col-amount">Закупка (нал)</th>
              <th class="col-amount">Закупка (безнал)</th>
              <th class="col-amount">Прибыль (ред.)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in rows" :key="row.name + '|' + row.unit">
              <td class="text-center">{{ idx + 1 }}</td>
              <td>{{ row.name }}</td>
              <td class="text-center">{{ row.unit }}</td>
              <td class="text-right">{{ formatNumber(row.totalQty) }}</td>
              <td class="text-right">
                <input
                  v-model.number="row.salePriceUnit"
                  type="number"
                  step="0.01"
                  class="input price"
                />
              </td>
              <td class="text-right">{{ formatMoney(row.saleTotalEdited) }}</td>
              <td class="text-right">{{ formatMoney(row.totalPurchaseCash) }}</td>
              <td class="text-right">{{ formatMoney(row.totalPurchaseCashless) }}</td>
              <td class="text-right">{{ formatMoney(row.incomeEdited) }}</td>
            </tr>
            <tr v-if="rows.length === 0">
              <td colspan="9" class="empty">Нет данных за период.</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" class="text-right total">Итого:</td>
              <td class="text-right total">{{ formatMoney(summaryComputed.totalSale) }}</td>
              <td class="text-right total">{{ formatMoney(summary.totalPurchaseCash) }}</td>
              <td class="text-right total">{{ formatMoney(summary.totalPurchaseCashless) }}</td>
              <td class="text-right total">{{ formatMoney(summaryComputed.totalIncome) }}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section class="signatures">
        <div class="sign-line">
          <span>Подпись ____________________</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

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

interface EditableRow extends CounterpartyReportItemRow {
  salePriceUnit: number;
  saleTotalEdited: number;
  incomeEdited: number;
}

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const error = ref('');

const from = ref('');
const to = ref('');

const editableCounterpartyName = ref('');
const editableCounterpartyPhone = ref('');

const summary = reactive<CounterpartyReportSummary>({
  totalPurchaseCash: 0,
  totalPurchaseCashless: 0,
  totalSale: 0,
  totalIncome: 0,
});

const rows = ref<EditableRow[]>([]);

const formatNumber = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

const formatMoney = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const computeRow = (r: EditableRow) => {
  const qty = Number(r.totalQty) || 0;
  const price = Number(r.salePriceUnit) || 0;
  const saleTotalEdited = qty * price;
  const purchaseTotal = (Number(r.totalPurchaseCash) || 0) + (Number(r.totalPurchaseCashless) || 0);
  const incomeEdited = saleTotalEdited - purchaseTotal;
  r.saleTotalEdited = saleTotalEdited;
  r.incomeEdited = incomeEdited;
};

watch(
  rows,
  () => {
    for (const r of rows.value) {
      computeRow(r);
    }
  },
  { deep: true }
);

const summaryComputed = computed(() => {
  let totalSale = 0;
  let totalIncome = 0;
  for (const r of rows.value) {
    totalSale += Number(r.saleTotalEdited) || 0;
    totalIncome += Number(r.incomeEdited) || 0;
  }
  return { totalSale, totalIncome };
});

const loadReport = async () => {
  const id = route.params.id as string;
  if (!id) {
    error.value = 'Не указан идентификатор контрагента';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const params: any = {};
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;

    const res = await axios.get(`/api/v1/counterparty-reports/${id}/report`, { params });
    const data = res.data || {};

    editableCounterpartyName.value = String(data.counterparty?.name || '');

    summary.totalPurchaseCash = Number(data.summary?.totalPurchaseCash) || 0;
    summary.totalPurchaseCashless = Number(data.summary?.totalPurchaseCashless) || 0;
    summary.totalSale = Number(data.summary?.totalSale) || 0;
    summary.totalIncome = Number(data.summary?.totalIncome) || 0;

    const items = (data.items || []) as CounterpartyReportItemRow[];
    rows.value = items.map((it) => {
      const qty = Number(it.totalQty) || 0;
      const unitPrice = qty > 0 ? (Number(it.totalSale) || 0) / qty : 0;
      const r: EditableRow = {
        ...it,
        salePriceUnit: unitPrice,
        saleTotalEdited: 0,
        incomeEdited: 0,
      };
      computeRow(r);
      return r;
    });
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки отчёта по контрагенту';
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

onMounted(async () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const yyyyMmDd = (d: Date) => d.toISOString().slice(0, 10);

  from.value = (route.query.from as string) || yyyyMmDd(firstDay);
  to.value = (route.query.to as string) || yyyyMmDd(now);

  await loadReport();
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

.status {
  max-width: 900px;
  margin: 0 auto;
  padding: 16px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #111827;
}

.status.error {
  color: #b91c1c;
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
  font-size: 12px;
  margin-top: 6px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

.parties {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin: 12px 0 18px;
  font-size: 13px;
}

.parties .row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.label {
  color: #6b7280;
  min-width: 96px;
}

.items table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.items th,
.items td {
  border: 1px solid #e5e7eb;
  padding: 6px 8px;
}

.items thead th {
  background: #f3f4f6;
  font-weight: 600;
}

.col-index {
  width: 32px;
}

.col-unit {
  width: 52px;
}

.col-qty {
  width: 80px;
}

.col-price {
  width: 140px;
}

.col-amount {
  width: 120px;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.input {
  border: 1px solid #d1d5db;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
}

.input.wide {
  min-width: 320px;
}

.input.price {
  width: 110px;
  text-align: right;
}

.btn {
  border: 1px solid #d1d5db;
  background: white;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.btn:hover {
  background: #e5e7eb;
}

.summary {
  margin: 12px 0 18px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.card {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 8px;
}

.card .k {
  color: #6b7280;
  font-size: 11px;
}

.card .v {
  font-size: 14px;
  font-weight: 600;
}

.hint {
  margin-top: 8px;
  font-size: 11px;
  color: #6b7280;
}

.total {
  font-weight: 700;
  background: #f9fafb;
}

.empty {
  text-align: center;
  padding: 10px;
  color: #6b7280;
}

.signatures {
  margin-top: 18px;
}

.sign-line {
  margin-top: 12px;
  font-size: 13px;
}

@media print {
  .no-print {
    display: none !important;
  }

  body {
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-page {
    background: white;
    padding: 0;
  }

  .sheet {
    box-shadow: none;
    max-width: none;
    padding: 0;
  }

  .input,
  .btn {
    border: none;
    padding: 0;
  }
}
</style>
