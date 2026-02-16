<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Клиенты</h1>
    </div>

    <!-- ТОП клиентов -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="font-semibold text-sm">ТОП клиентов по выручке</div>
        <div class="flex items-center gap-2 text-[11px] flex-wrap">
          <div class="flex items-center gap-1">
            <span class="text-slate-400">Период:</span>
            <input
              v-model="topFrom"
              type="date"
              class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
            />
            <span class="text-slate-400">—</span>
            <input
              v-model="topTo"
              type="date"
              class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
            />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-slate-400">Топ</span>
            <input
              v-model.number="topLimit"
              type="number"
              min="1"
              max="100"
              class="w-16 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-right"
            />
          </div>
          <button
            type="button"
            class="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white disabled:opacity-60"
            :disabled="topLoading"
            @click="loadTopClients"
          >
            {{ topLoading ? 'Загрузка...' : 'Показать' }}
          </button>
          <span v-if="topError" class="text-red-400">{{ topError }}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]" v-if="topSummary">
        <div>
          <div class="text-slate-400">Всего клиентов в выборке</div>
          <div class="text-slate-100 font-semibold">{{ topRows.length }}</div>
        </div>
        <div>
          <div class="text-slate-400">Сумма продаж</div>
          <div class="text-emerald-400 text-sm font-semibold">
            {{ topSummary.totalSales.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Доход</div>
          <div class="text-amber-300 text-sm font-semibold">
            {{ topSummary.totalIncome.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽
          </div>
        </div>
      </div>

      <div class="border border-slate-800 rounded-lg overflow-hidden mt-2">
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Клиент</th>
              <th class="px-2 py-1 text-left">Контакты</th>
              <th class="px-2 py-1 text-right">Накладных</th>
              <th class="px-2 py-1 text-right">Сумма продаж</th>
              <th class="px-2 py-1 text-right">Доход</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in topRows"
              :key="row.clientId || row.clientName || row.clientEmail || row.clientPhone || Math.random()"
              class="border-t border-slate-800"
            >
              <td class="px-2 py-1">
                {{ row.clientName || 'Без имени' }}
              </td>
              <td class="px-2 py-1">
                <div class="text-slate-200">{{ row.clientPhone || '' }}</div>
                <div v-if="row.clientEmail" class="text-slate-400">{{ row.clientEmail }}</div>
              </td>
              <td class="px-2 py-1 text-right">
                {{ row.invoicesCount }}
              </td>
              <td class="px-2 py-1 text-right">
                {{ row.totalSales.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td class="px-2 py-1 text-right">
                {{ row.totalIncome.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
            </tr>
            <tr v-if="!topLoading && topRows.length === 0">
              <td colspan="5" class="px-2 py-3 text-center text-slate-400">Нет данных по клиентам за выбранный период.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Список клиентов -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex-1 min-w-[220px]">
          <label class="block text-[11px] text-slate-400 mb-1">Поиск клиента</label>
          <input
            v-model="search"
            type="text"
            placeholder="Имя, телефон или email"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
            @input="debouncedLoad"
          />
        </div>
        <div>
          <button
            type="button"
            class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white"
            @click="startCreate"
          >
            + Новый клиент
          </button>
        </div>
      </div>

      <div class="overflow-x-auto max-h-[360px] border border-slate-800 rounded-lg mt-3">
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Имя</th>
              <th class="px-2 py-1 text-left">Телефон</th>
              <th class="px-2 py-1 text-left">Email</th>
              <th class="px-2 py-1 text-left">Город</th>
              <th class="px-2 py-1 text-left">Адрес</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in clients"
              :key="c._id"
              class="border-t border-slate-800 cursor-pointer hover:bg-slate-800/60"
              @click="selectClient(c)"
            >
              <td class="px-2 py-1">{{ c.name }}</td>
              <td class="px-2 py-1">{{ c.phone }}</td>
              <td class="px-2 py-1">{{ c.email }}</td>
              <td class="px-2 py-1">{{ c.city }}</td>
              <td class="px-2 py-1 truncate max-w-[180px]" :title="c.address">{{ c.address }}</td>
            </tr>
            <tr v-if="!clients.length && !loading">
              <td colspan="5" class="px-2 py-3 text-center text-slate-400">Клиенты не найдены.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="error" class="text-xs text-red-400 mt-2">{{ error }}</div>
    </div>

    <!-- Форма клиента -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold text-sm">
          {{ current?. _id ? 'Редактирование клиента' : 'Новый клиент' }}
        </div>
        <div v-if="current && current._id" class="text-[11px] text-slate-400">
          ID: {{ current._id }}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Имя / название *</label>
          <input
            v-model="form.name"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Телефон</label>
          <input
            v-model="form.phone"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Email</label>
          <input
            v-model="form.email"
            type="email"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Город</label>
          <input
            v-model="form.city"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Адрес</label>
          <input
            v-model="form.address"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label class="block text-[11px] text-slate-400 mb-1">Заметки</label>
          <input
            v-model="form.notes"
            type="text"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div class="flex items-center justify-between mt-2">
        <div class="space-x-2">
          <button
            type="button"
            class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60"
            :disabled="saving || !form.name.trim()"
            @click="saveClient"
          >
            {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
          <button
            type="button"
            class="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white"
            @click="startCreate"
          >
            Новый
          </button>
        </div>
        <div v-if="current && current._id" class="text-[11px] flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white disabled:opacity-60"
            :disabled="reportLoading"
            @click="loadClientReport"
          >
            {{ reportLoading ? 'Загрузка отчёта...' : 'Отчёт по покупкам' }}
          </button>
          <span v-if="reportError" class="text-red-400">{{ reportError }}</span>
        </div>
      </div>
    </div>

    <!-- Отчёт по клиенту -->
    <div
      v-if="current && current._id && clientReport"
      class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold text-sm">Отчёт по покупкам клиента</div>
        <div class="text-[11px] text-slate-400">
          Накладных: {{ clientReport.summary.invoicesCount }}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
        <div>
          <div class="text-slate-400">Клиент</div>
          <div class="text-slate-100 font-medium">{{ clientReport.client.name }}</div>
          <div class="text-slate-400">
            {{ clientReport.client.phone || '' }}
            <span v-if="clientReport.client.email"> · {{ clientReport.client.email }}</span>
          </div>
        </div>
        <div>
          <div class="text-slate-400">Сумма продаж</div>
          <div class="text-emerald-400 text-sm font-semibold">
            {{ clientReport.summary.totalSales.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Доход</div>
          <div class="text-amber-300 text-sm font-semibold">
            {{ clientReport.summary.totalIncome.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} ₽
          </div>
        </div>
      </div>

      <div class="border border-slate-800 rounded-lg overflow-hidden mt-2">
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Дата</th>
              <th class="px-2 py-1 text-left">№</th>
              <th class="px-2 py-1 text-left">Покупатель (строка)</th>
              <th class="px-2 py-1 text-right">Сумма</th>
              <th class="px-2 py-1 text-right">Доход</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="inv in clientReport.invoices"
              :key="inv._id"
              class="border-t border-slate-800"
            >
              <td class="px-2 py-1">{{ new Date(inv.date).toLocaleDateString('ru-RU') }}</td>
              <td class="px-2 py-1">{{ inv.number }}</td>
              <td class="px-2 py-1 truncate max-w-[220px]" :title="inv.client">{{ inv.client }}</td>
              <td class="px-2 py-1 text-right">
                {{ (inv.totalAmount || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
              <td class="px-2 py-1 text-right">
                {{ (inv.totalIncome || 0).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>
            </tr>
            <tr v-if="clientReport.invoices.length === 0">
              <td colspan="5" class="px-2 py-3 text-center text-slate-400">Накладные для этого клиента не найдены.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import axios from 'axios';

interface ClientDto {
  _id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  notes: string;
}

const clients = ref<ClientDto[]>([]);
const loading = ref(false);
const error = ref('');
const search = ref('');

const current = ref<ClientDto | null>(null);

const emptyForm = (): ClientForm => ({
  name: '',
  phone: '',
  email: '',
  city: '',
  address: '',
  notes: '',
});

const form = ref<ClientForm>(emptyForm());
const saving = ref(false);
let searchTimeout: number | undefined;

interface ClientReportSummary {
  totalSales: number;
  totalIncome: number;
  invoicesCount: number;
}

interface ClientReportInvoiceRow {
  _id: string;
  number: string;
  date: string;
  client: string;
  totalAmount: number;
  totalIncome: number;
}

interface ClientReportDto {
  client: ClientDto;
  summary: ClientReportSummary;
  invoices: ClientReportInvoiceRow[];
}

const clientReport = ref<ClientReportDto | null>(null);
const reportLoading = ref(false);
const reportError = ref('');

interface TopClientRow {
  clientId?: string;
  clientName?: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  totalSales: number;
  totalIncome: number;
  invoicesCount: number;
}

interface TopClientsSummary {
  totalSales: number;
  totalIncome: number;
  invoicesCount: number;
}

const topFrom = ref('');
const topTo = ref('');
const topLimit = ref(20);
const topRows = ref<TopClientRow[]>([]);
const topSummary = ref<TopClientsSummary | null>(null);
const topLoading = ref(false);
const topError = ref('');

const loadClients = async () => {
  loading.value = true;
  error.value = '';
  try {
    const params: any = {};
    if (search.value.trim()) params.q = search.value.trim();
    const res = await axios.get('/api/v1/clients', { params });
    clients.value = res.data?.clients || [];
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки клиентов';
  } finally {
    loading.value = false;
  }
};

const debouncedLoad = () => {
  if (searchTimeout) {
    window.clearTimeout(searchTimeout);
  }
  searchTimeout = window.setTimeout(() => {
    loadClients();
  }, 300);
};

const startCreate = () => {
  current.value = null;
  form.value = emptyForm();
};

const selectClient = (c: ClientDto) => {
  current.value = c;
  form.value = {
    name: c.name || '',
    phone: c.phone || '',
    email: c.email || '',
    city: c.city || '',
    address: c.address || '',
    notes: c.notes || '',
  };
  clientReport.value = null;
  reportError.value = '';
};

const saveClient = async () => {
  if (!form.value.name.trim()) return;

  saving.value = true;
  error.value = '';

  try {
    const payload = {
      name: form.value.name.trim(),
      phone: form.value.phone || undefined,
      email: form.value.email || undefined,
      city: form.value.city || undefined,
      address: form.value.address || undefined,
      notes: form.value.notes || undefined,
    };

    let res;
    if (current.value && current.value._id) {
      res = await axios.put(`/api/v1/clients/${current.value._id}`, payload);
    } else {
      res = await axios.post('/api/v1/clients', payload);
    }

    const saved: ClientDto = res.data?.client;
    if (saved && saved._id) {
      // Обновляем список локально
      const idx = clients.value.findIndex((x) => x._id === saved._id);
      if (idx >= 0) {
        clients.value.splice(idx, 1, saved);
      } else {
        clients.value.unshift(saved);
      }
      selectClient(saved);
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка сохранения клиента';
  } finally {
    saving.value = false;
  }
};

const loadTopClients = async () => {
  topLoading.value = true;
  topError.value = '';
  try {
    const params: any = { limit: topLimit.value || 20 };
    if (topFrom.value) params.from = topFrom.value;
    if (topTo.value) params.to = topTo.value;

    const res = await axios.get('/api/v1/clients/top/list', { params });
    topRows.value = (res.data?.rows || []) as TopClientRow[];
    topSummary.value = (res.data?.summary || null) as TopClientsSummary | null;
  } catch (e: any) {
    topError.value = e?.response?.data?.message || 'Ошибка загрузки ТОП клиентов';
  } finally {
    topLoading.value = false;
  }
};

const loadClientReport = async () => {
  if (!current.value || !current.value._id) return;

  reportLoading.value = true;
  reportError.value = '';
  try {
    const res = await axios.get(`/api/v1/clients/${current.value._id}/report`);
    clientReport.value = res.data as ClientReportDto;
  } catch (e: any) {
    reportError.value = e?.response?.data?.message || 'Ошибка загрузки отчёта по клиенту';
  } finally {
    reportLoading.value = false;
  }
};

// начальная загрузка
loadClients();
loadTopClients();
</script>
