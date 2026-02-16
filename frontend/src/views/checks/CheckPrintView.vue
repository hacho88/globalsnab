<template>
  <div class="min-h-screen bg-white text-black p-8 print:p-4">
    <div v-if="loading" class="text-center text-sm">Загрузка...</div>
    <div v-else-if="error" class="text-center text-sm text-red-600">{{ error }}</div>
    <div
      v-else-if="check"
      id="check-print-page"
      class="max-w-4xl mx-auto text-[13px] leading-snug border border-gray-300 rounded-md px-10 py-8 shadow-sm print:shadow-none"
    >
      <!-- Верхняя строка с датой печати и названием системы -->
      <div class="flex justify-between text-[11px] text-gray-500 mb-4">
        <div>{{ formatDateTime(new Date()) }}</div>
        <div>GlobalSnab ERP</div>
      </div>

      <!-- Тонкая линия-разделитель -->
      <div class="border-t border-gray-300 mb-6"></div>

      <!-- Заголовок документа -->
      <div class="mb-6 text-center">
        <div class="font-bold text-2xl tracking-[0.15em] uppercase mb-1">ТОВАРНЫЙ ЧЕК</div>
        <div class="mt-1 text-sm" v-if="check.shopName">{{ check.shopName }}</div>
      </div>

      <!-- Реквизиты магазина и чека -->
      <div class="flex justify-between items-start mb-4 text-[12px]">
        <div class="space-y-1 max-w-[60%]">
          <div v-if="check.shopAddress"><span class="font-semibold">Адрес магазина:</span> {{ check.shopAddress }}</div>
          <div v-if="check.shopContacts"><span class="font-semibold">Контакты:</span> {{ check.shopContacts }}</div>
        </div>
        <div class="text-right space-y-1">
          <div><span class="font-semibold">Чек №</span> {{ check.number }}</div>
          <div><span class="font-semibold">Дата продажи:</span> {{ formatDateTime(check.date) }}</div>
        </div>
      </div>

      <div v-if="check.comment" class="mb-4 text-[12px]">
        <span class="font-semibold">Комментарий:</span> {{ check.comment }}
      </div>

      <!-- Таблица позиций -->
      <table class="w-full border-collapse text-[12px] mb-6">
        <thead>
          <tr class="bg-gray-100">
            <th class="border border-gray-400 px-2 py-1 text-left w-8">№</th>
            <th class="border border-gray-400 px-2 py-1 text-left w-24">Артикул</th>
            <th class="border border-gray-400 px-2 py-1 text-left">Наименование</th>
            <th class="border border-gray-400 px-2 py-1 text-right w-16">Кол-во</th>
            <th class="border border-gray-400 px-2 py-1 text-right w-20">Цена</th>
            <th class="border border-gray-400 px-2 py-1 text-right w-24">Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in check.items" :key="idx" :class="idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'">
            <td class="border border-gray-300 px-2 py-1 align-top">{{ idx + 1 }}</td>
            <td class="border border-gray-300 px-2 py-1 align-top">{{ item.sku || '' }}</td>
            <td class="border border-gray-300 px-2 py-1 align-top">{{ item.name }}</td>
            <td class="border border-gray-300 px-2 py-1 text-right align-top">{{ formatNumber(item.quantity) }}</td>
            <td class="border border-gray-300 px-2 py-1 text-right align-top">{{ formatMoney(item.price) }}</td>
            <td class="border border-gray-300 px-2 py-1 text-right align-top">{{ formatMoney(item.amount) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td class="border border-gray-400 px-2 py-2 text-right font-semibold" colspan="5">Итого к оплате:</td>
            <td class="border border-gray-400 px-2 py-2 text-right font-semibold">{{ formatMoney(check.totalAmount) }}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Подписи -->
      <div class="flex justify-between mt-10 text-xs">
        <div>Подпись продавца ___________________________</div>
        <div>Подпись покупателя ___________________________</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';

interface CheckItemPrint {
  sku?: string | null;
  name: string;
  quantity: number;
  price: number;
  amount: number;
}

interface CheckPrint {
  _id: string;
  number: string;
  date: string;
  comment?: string;
  totalAmount: number;
  shopName?: string | null;
  shopAddress?: string | null;
  shopContacts?: string | null;
  items: CheckItemPrint[];
}

const route = useRoute();
const check = ref<CheckPrint | null>(null);
const loading = ref(false);
const error = ref('');

const formatDateTime = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleString('ru-RU');
};

const formatNumber = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
};

const formatMoney = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const loadCheck = async () => {
  const id = route.params.id as string;
  if (!id) {
    error.value = 'Не указан идентификатор чека';
    return;
  }

  loading.value = true;
  error.value = '';
  try {
    const res = await axios.get(`/api/v1/checks/${id}`);
    const c = res.data?.check as any;
    if (!c) {
      error.value = 'Чек не найден';
      return;
    }
    check.value = c as CheckPrint;
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки чека';
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadCheck();
  if (check.value) {
    setTimeout(() => {
      window.print();
    }, 200);
  }
});
</script>

<style>
@media print {
  body {
    margin: 0;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  body * {
    visibility: hidden;
  }

  #check-print-page,
  #check-print-page * {
    visibility: visible;
  }

  #check-print-page {
    position: absolute;
    inset: 0;
    margin: 0;
    box-shadow: none !important;
    border-radius: 0;
  }
}
</style>
