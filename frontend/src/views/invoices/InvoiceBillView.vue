<template>
  <div class="print-page">
    <div class="print-toolbar no-print">
      <button type="button" @click="onPrint">Печать</button>
      <button type="button" @click="onBack">Назад</button>
    </div>

    <div v-if="loading" class="status">Загрузка счёта...</div>
    <div v-else-if="error" class="status error">{{ error }}</div>

    <div v-else-if="invoice" class="sheet">
      <div class="attention">
        Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате
        обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту
        прихода денег на р/с Поставщика, самовывозом, при наличии доверенности и паспорта.
      </div>

      <table class="bank">
        <tbody>
          <tr>
            <td class="bank-left">{{ supplierBank.bankName }}</td>
            <td class="bank-right">
              <div class="bank-row"><span class="label">БИК</span> <span class="value">{{ supplierBank.bik }}</span></div>
              <div class="bank-row"><span class="label">Сч. №</span> <span class="value">{{ supplierBank.bankAccount }}</span></div>
            </td>
          </tr>
          <tr>
            <td class="bank-left">
              <div class="bank-row"><span class="label">ИНН</span> <span class="value">{{ supplierBank.inn }}</span></div>
              <div class="bank-row"><span class="label">КПП</span> <span class="value">{{ supplierBank.kpp }}</span></div>
            </td>
            <td class="bank-right">
              <div class="bank-row"><span class="label">Сч. №</span> <span class="value">{{ supplierBank.correspondentAccount }}</span></div>
            </td>
          </tr>
          <tr>
            <td class="bank-left">
              <div class="bank-row"><span class="label">Получатель</span> <span class="value">{{ supplierBank.recipient }}</span></div>
            </td>
            <td class="bank-right"></td>
          </tr>
        </tbody>
      </table>

      <div class="title">Счет на оплату № {{ invoice.number }} от {{ formatDateLong(invoice.date) }} г.</div>

      <div class="party"><span class="label">Поставщик:</span> <span class="value">{{ invoice.supplier || supplierBank.recipient }}</span></div>
      <div class="party"><span class="label">Покупатель:</span> <span class="value">{{ invoice.client || 'Частное лицо' }}</span></div>
      <div class="party"><span class="label">Примечание:</span> <span class="value">{{ note }}</span></div>

      <table class="items">
        <thead>
          <tr>
            <th class="col-n">№</th>
            <th class="col-name">Товары (работы, услуги)</th>
            <th class="col-qty">Кол-во</th>
            <th class="col-unit">Ед. изм.</th>
            <th class="col-price">Цена</th>
            <th class="col-sum">Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="billRows.length === 0">
            <td colspan="6" class="empty">Товары не найдены в накладной</td>
          </tr>
          <tr v-for="(row, idx) in billRows" :key="idx">
            <td class="text-center">{{ idx + 1 }}</td>
            <td>{{ row.name }}</td>
            <td class="text-right">{{ formatNumber(row.quantity) }}</td>
            <td class="text-center">{{ row.unit }}</td>
            <td class="text-right">{{ formatMoney(row.price) }}</td>
            <td class="text-right">{{ formatMoney(row.amount) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div class="summary-row"><span class="label">Итого:</span> <span class="value">{{ formatMoney(totalAmount) }}</span></div>
        <div class="summary-row"><span class="label">Без налога (НДС)</span> <span class="value">-</span></div>
        <div class="summary-row"><span class="label">Всего к оплате:</span> <span class="value">{{ formatMoney(totalAmount) }}</span></div>
      </div>

      <div class="footer">
        <div class="footer-text">Всего наименований {{ billRows.length }}, на сумму {{ formatMoney(totalAmount) }} руб.</div>
        <div class="footer-text">{{ amountToWordsStub }}</div>

        <div class="signs">
          <div class="sign">Руководитель ____________________</div>
          <div class="sign">Бухгалтер ____________________</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

interface InvoiceItem {
  name: string;
  unit: string;
  quantity: number;
  salePrice: number;
}

interface InvoiceFull {
  _id: string;
  number: string;
  date: string;
  supplier: string;
  client: string;
  totalAmount: number;
  deliveryPrice?: number;
  items: InvoiceItem[];
}

const supplierBank = {
  bankName: 'БАНК ПОЛУЧАТЕЛЯ',
  bik: '000000000',
  bankAccount: '00000000000000000000',
  inn: '0000000000',
  kpp: '000000000',
  correspondentAccount: '00000000000000000000',
  recipient: 'ПОЛУЧАТЕЛЬ',
};

const route = useRoute();
const router = useRouter();

const invoice = ref<InvoiceFull | null>(null);
const loading = ref(false);
const error = ref('');
const note = ref('');

const formatDateLong = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
};

const formatNumber = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
};

const formatMoney = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const billRows = computed(() => {
  const rows: { name: string; unit: string; quantity: number; price: number; amount: number }[] = [];

  const inv = invoice.value as any;
  if (!inv) return rows;

  const rawItems = Array.isArray(inv.items) ? inv.items : Array.isArray(inv.invoice?.items) ? inv.invoice.items : [];
  for (const it of rawItems || []) {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.salePrice ?? it.price) || 0;
    rows.push({
      name: String(it.name || ''),
      unit: String(it.unit || 'шт'),
      quantity: qty,
      price,
      amount: qty * price,
    });
  }

  const delivery = Number(inv.deliveryPrice || 0) || 0;
  if (delivery > 0) {
    rows.push({
      name: 'Доставка',
      unit: 'рейс',
      quantity: 1,
      price: delivery,
      amount: delivery,
    });
  }

  return rows;
});

const totalAmount = computed(() => {
  return billRows.value.reduce((acc, r) => acc + (Number(r.amount) || 0), 0);
});

const amountToWordsStub = computed(() => {
  return 'Без НДС.';
});

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

.sheet {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  padding: 18px 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #111827;
}

.attention {
  font-size: 11px;
  text-align: center;
  margin-bottom: 10px;
  line-height: 1.25;
}

.bank {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-bottom: 10px;
}

.bank td {
  border: 1px solid #111827;
  padding: 6px 8px;
  vertical-align: top;
}

.bank-left {
  width: 62%;
}

.bank-right {
  width: 38%;
}

.bank-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.bank-row .label {
  white-space: nowrap;
}

.title {
  font-weight: 700;
  font-size: 16px;
  margin: 8px 0 10px;
}

.party {
  font-size: 12px;
  margin: 4px 0;
}

.party .label {
  font-weight: 600;
}

.items {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  margin-top: 10px;
}

.items th,
.items td {
  border: 1px solid #111827;
  padding: 3px 5px;
}

.empty {
  text-align: center;
  padding: 10px 6px;
}

.items thead th {
  text-align: center;
}

.col-n {
  width: 32px;
}

.col-qty {
  width: 70px;
}

.col-unit {
  width: 70px;
}

.col-price {
  width: 90px;
}

.col-sum {
  width: 100px;
}

.text-right {
  text-align: right;
}

.text-center {
  text-align: center;
}

.summary {
  margin-top: 10px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-end;
}

.summary-row {
  display: flex;
  gap: 10px;
}

.summary-row .label {
  min-width: 140px;
  text-align: right;
}

.summary-row .value {
  min-width: 120px;
  text-align: right;
}

.footer {
  margin-top: 10px;
  font-size: 11px;
}

.footer-text {
  margin-top: 4px;
}

.signs {
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.sign {
  width: 45%;
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

  .print-page {
    background: white;
    padding: 0;
  }

  .sheet {
    box-shadow: none;
    margin: 0;
    width: 100%;
    max-width: 100%;
    padding: 0;
  }
}
</style>
