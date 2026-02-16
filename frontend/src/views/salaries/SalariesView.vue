<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Зарплаты работникам</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-2 text-xs text-slate-200 inline-flex gap-1">
      <button
        type="button"
        class="px-3 py-1 rounded border"
        :class="activeTab === 'drivers' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'"
        @click="activeTab = 'drivers'"
      >
        Водители
      </button>
      <button
        type="button"
        class="px-3 py-1 rounded border"
        :class="activeTab === 'managers' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'"
        @click="activeTab = 'managers'"
      >
        Менеджеры
      </button>
      <button
        type="button"
        class="px-3 py-1 rounded border"
        :class="activeTab === 'payouts' ? 'bg-sky-600 border-sky-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300'"
        @click="activeTab = 'payouts'"
      >
        Выплаты
      </button>
    </div>

    <!-- Зарплаты водителей -->
    <div v-if="activeTab === 'drivers'" class="space-y-3">
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Период с</label>
            <input v-model="driverFrom" type="date" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">по</label>
            <input v-model="driverTo" type="date" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
          </div>
          <div class="min-w-[220px]">
            <label class="block text-[11px] text-slate-400 mb-1">Водитель</label>
            <select v-model="driverId" class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
              <option value="">Все водители</option>
              <option v-for="d in driverOptions" :key="d._id" :value="d._id">
                {{ d.fullName }}
              </option>
            </select>
          </div>
          <div class="flex flex-col gap-1">
            <span class="block text-[11px] text-slate-400 mb-0.5">Быстрый период</span>
            <div class="flex gap-1">
              <button
                type="button"
                class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
                @click="applyPreset('driver', 'today')"
              >
                Сегодня
              </button>
              <button
                type="button"
                class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
                @click="applyPreset('driver', 'week')"
              >
                Неделя
              </button>
              <button
                type="button"
                class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
                @click="applyPreset('driver', 'month')"
              >
                Месяц
              </button>
            </div>
          </div>
          <div>
            <button
              type="button"
              class="mt-4 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-xs text-white disabled:opacity-60"
              :disabled="driverLoading"
              @click="loadDriverSalaries"
            >
              {{ driverLoading ? 'Загрузка...' : 'Обновить' }}
            </button>
          </div>
          <div class="text-[11px] text-slate-400 flex-1 min-w-[200px]">
            Расчёт: зарплата водителя = сумма доставки * доля водителя по машине (33% или 50%).
          </div>
        </div>

        <div v-if="driverError" class="text-xs text-red-400">{{ driverError }}</div>

        <div
          v-if="driverRows.length"
          class="mt-2 text-[11px] text-slate-300 flex flex-wrap gap-4"
        >
          <div>
            <div class="text-slate-400 mb-0.5">Сводка по водителям за период</div>
            <ul class="space-y-0.5">
              <li
                v-for="summaryRow in driverRowsByPerson"
                :key="summaryRow.name || summaryRow.id"
                class="flex justify-between gap-4 min-w-[220px]"
              >
                <span>{{ summaryRow.name || 'Без водителя' }}</span>
                <span class="font-semibold">{{ formatMoney(summaryRow.totalSalary) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <div class="overflow-x-auto mt-2">
          <table class="min-w-full text-[11px]">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-1 text-left">Дата</th>
                <th class="px-2 py-1 text-left">№</th>
                <th class="px-2 py-1 text-left">Водитель</th>
                <th class="px-2 py-1 text-left">Машина</th>
                <th class="px-2 py-1 text-right">Доставка</th>
                <th class="px-2 py-1 text-right">Доля водителя</th>
                <th class="px-2 py-1 text-right">Зарплата</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in driverRows" :key="row.invoiceId" class="border-t border-slate-800">
                <td class="px-2 py-1">{{ formatDate(row.date) }}</td>
                <td class="px-2 py-1">{{ row.number }}</td>
                <td class="px-2 py-1">{{ row.driverName || '—' }}</td>
                <td class="px-2 py-1">{{ row.carName || '—' }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(row.deliveryPrice) }}</td>
                <td class="px-2 py-1 text-right">{{ (row.sharePercent * 100).toFixed(0) }}%</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(row.driverSalary) }}</td>
              </tr>
              <tr v-if="!driverLoading && driverRows.length === 0">
                <td colspan="7" class="px-2 py-3 text-center text-slate-400">Нет накладных за выбранный период.</td>
              </tr>
            </tbody>
            <tfoot v-if="driverRows.length">
              <tr class="border-t border-slate-700 bg-slate-900/60">
                <td colspan="4" class="px-2 py-1 text-right font-medium">Итого:</td>
                <td class="px-2 py-1 text-right font-medium">{{ formatMoney(driverSummary.totalDelivery) }}</td>
                <td class="px-2 py-1"></td>
                <td class="px-2 py-1 text-right font-medium">{{ formatMoney(driverSummary.totalSalary) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Зарплаты менеджеров -->
    <div v-else-if="activeTab === 'managers'" class="space-y-3">
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Период с</label>
            <input v-model="managerFrom" type="date" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
          </div>
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">по</label>
            <input v-model="managerTo" type="date" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
          </div>
          <div class="min-w-[220px]">
            <label class="block text-[11px] text-slate-400 mb-1">Менеджер</label>
            <select v-model="managerId" class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs">
              <option value="">Все менеджеры</option>
              <option
                v-for="m in managerRowsByPerson"
                :key="m.id || m.name"
                :value="m.id || ''"
              >
                {{ m.name || 'Без менеджера' }}
              </option>
            </select>
          </div>
          <div>
            <button
              type="button"
              class="mt-4 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-xs text-white disabled:opacity-60"
              :disabled="managerLoading"
              @click="loadManagerSalaries"
            >
              {{ managerLoading ? 'Загрузка...' : 'Обновить' }}
            </button>
          </div>
          <div class="text-[11px] text-slate-400 flex-1 min-w-[200px]">
            Расчёт: зарплата менеджера = 20% от чистой прибыли по накладной (totalIncome), доставка не учитывается.
          </div>
        </div>

        <div v-if="managerError" class="text-xs text-red-400">{{ managerError }}</div>

        <div class="overflow-x-auto mt-2">
          <table class="min-w-full text-[11px]">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-1 text-left">Дата</th>
                <th class="px-2 py-1 text-left">№</th>
                <th class="px-2 py-1 text-left">Менеджер</th>
                <th class="px-2 py-1 text-right">Чистая прибыль</th>
                <th class="px-2 py-1 text-right">Доля менеджера</th>
                <th class="px-2 py-1 text-right">Зарплата</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in managerRows" :key="row.invoiceId" class="border-t border-slate-800">
                <td class="px-2 py-1">{{ formatDate(row.date) }}</td>
                <td class="px-2 py-1">{{ row.number }}</td>
                <td class="px-2 py-1">{{ row.managerName || '—' }}</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(row.totalIncome) }}</td>
                <td class="px-2 py-1 text-right">{{ (row.salaryPercent * 100).toFixed(0) }}%</td>
                <td class="px-2 py-1 text-right">{{ formatMoney(row.managerSalary) }}</td>
              </tr>
              <tr v-if="!managerLoading && managerRows.length === 0">
                <td colspan="6" class="px-2 py-3 text-center text-slate-400">Нет накладных за выбранный период.</td>
              </tr>
            </tbody>
            <tfoot v-if="managerRows.length">
              <tr class="border-t border-slate-700 bg-slate-900/60">
                <td colspan="3" class="px-2 py-1 text-right font-medium">Итого:</td>
                <td class="px-2 py-1 text-right font-medium">{{ formatMoney(managerSummary.totalIncome) }}</td>
                <td class="px-2 py-1"></td>
                <td class="px-2 py-1 text-right font-medium">{{ formatMoney(managerSummary.totalSalary) }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Выплаты за месяц (выдано/не выдано) -->
    <div v-else class="space-y-3">
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="block text-[11px] text-slate-400 mb-1">Месяц начисления (YYYY-MM)</label>
            <input v-model="payoutMonth" type="month" class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" />
          </div>
          <div>
            <button
              type="button"
              class="mt-4 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-xs text-white disabled:opacity-60"
              :disabled="payoutLoading"
              @click="loadPayoutSummary"
            >
              {{ payoutLoading ? 'Загрузка...' : 'Обновить' }}
            </button>
          </div>
          <div class="text-[11px] text-slate-400 flex-1 min-w-[220px]">
            Зарплата за месяц считается по накладным внутри выбранного месяца.
            Выплату обычно отмечаем в период 1–5 числа следующего месяца.
          </div>
        </div>

        <div v-if="payoutError" class="text-xs text-red-400">{{ payoutError }}</div>

        <div v-if="payoutSummary" class="space-y-4">
          <div>
            <div class="text-[11px] uppercase text-slate-400 tracking-wide mb-2">Водители</div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-[11px]">
                <thead class="bg-slate-900 text-slate-300">
                  <tr>
                    <th class="px-2 py-1 text-left">Водитель</th>
                    <th class="px-2 py-1 text-right">Начислено</th>
                    <th class="px-2 py-1 text-left">Статус</th>
                    <th class="px-2 py-1 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in payoutSummary.drivers" :key="p.personId" class="border-t border-slate-800">
                    <td class="px-2 py-1">{{ p.name }}</td>
                    <td class="px-2 py-1 text-right">{{ formatMoney(p.amountAccrued) }}</td>
                    <td class="px-2 py-1">
                      <span v-if="p.isPaid" class="text-emerald-400">Выдано</span>
                      <span v-else class="text-amber-400">Не выдано</span>
                    </td>
                    <td class="px-2 py-1 text-right space-x-1">
                      <button
                        v-if="!p.isPaid"
                        type="button"
                        class="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px]"
                        @click="markPaid('driver', p.personId, p.amountAccrued)"
                      >
                        Выдано
                      </button>
                      <button
                        v-else
                        type="button"
                        class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px]"
                        @click="undoPaid('driver', p.personId)"
                      >
                        Отменить
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!payoutLoading && payoutSummary.drivers.length === 0">
                    <td colspan="4" class="px-2 py-3 text-center text-slate-400">Нет начислений по водителям за месяц.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div class="text-[11px] uppercase text-slate-400 tracking-wide mb-2">Менеджеры</div>
            <div class="overflow-x-auto">
              <table class="min-w-full text-[11px]">
                <thead class="bg-slate-900 text-slate-300">
                  <tr>
                    <th class="px-2 py-1 text-left">Менеджер</th>
                    <th class="px-2 py-1 text-right">Начислено</th>
                    <th class="px-2 py-1 text-left">Статус</th>
                    <th class="px-2 py-1 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in payoutSummary.managers" :key="p.personId" class="border-t border-slate-800">
                    <td class="px-2 py-1">{{ p.name }}</td>
                    <td class="px-2 py-1 text-right">{{ formatMoney(p.amountAccrued) }}</td>
                    <td class="px-2 py-1">
                      <span v-if="p.isPaid" class="text-emerald-400">Выдано</span>
                      <span v-else class="text-amber-400">Не выдано</span>
                    </td>
                    <td class="px-2 py-1 text-right space-x-1">
                      <button
                        v-if="!p.isPaid"
                        type="button"
                        class="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white text-[11px]"
                        @click="markPaid('manager', p.personId, p.amountAccrued)"
                      >
                        Выдано
                      </button>
                      <button
                        v-else
                        type="button"
                        class="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-[11px]"
                        @click="undoPaid('manager', p.personId)"
                      >
                        Отменить
                      </button>
                    </td>
                  </tr>
                  <tr v-if="!payoutLoading && payoutSummary.managers.length === 0">
                    <td colspan="4" class="px-2 py-3 text-center text-slate-400">Нет начислений по менеджерам за месяц.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import axios from 'axios';

type Tab = 'drivers' | 'managers' | 'payouts';

const activeTab = ref<Tab>('drivers');

const todayStr = new Date().toISOString().slice(0, 10);

// Водители
const driverFrom = ref<string>(todayStr);
const driverTo = ref<string>(todayStr);
const driverId = ref<string>('');

interface DriverOption {
  _id: string;
  fullName: string;
}

interface DriverSalaryRow {
  invoiceId: string;
  date: string;
  number: string;
  driverId: string | null;
  driverName: string | null;
  carId: string | null;
  carName: string | null;
  deliveryPrice: number;
  sharePercent: number;
  driverSalary: number;
}

interface DriverSalarySummary {
  totalDelivery: number;
  totalSalary: number;
}

const driverOptions = ref<DriverOption[]>([]);
const driverRows = ref<DriverSalaryRow[]>([]);
const driverSummary = ref<DriverSalarySummary>({ totalDelivery: 0, totalSalary: 0 });
const driverLoading = ref(false);
const driverError = ref('');

// Менеджеры
const managerFrom = ref<string>(todayStr);
const managerTo = ref<string>(todayStr);
const managerId = ref<string>('');

interface ManagerSalaryRow {
  invoiceId: string;
  date: string;
  number: string;
  managerId: string | null;
  managerName: string | null;
  totalIncome: number;
  salaryPercent: number;
  managerSalary: number;
}

interface ManagerSalarySummary {
  totalIncome: number;
  totalSalary: number;
}

const managerRows = ref<ManagerSalaryRow[]>([]);
const managerSummary = ref<ManagerSalarySummary>({ totalIncome: 0, totalSalary: 0 });
const managerLoading = ref(false);
const managerError = ref('');

interface PersonSummaryRow {
  id: string | null;
  name: string | null;
  totalSalary: number;
}

const formatDate = (d: string | Date | undefined) => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('ru-RU');
};

const formatMoney = (v: number | undefined | null) => {
  const n = Number(v || 0);
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type SalaryPayoutPersonType = 'driver' | 'manager';

interface SalaryPayoutSummaryRow {
  personId: string;
  name: string;
  amountAccrued: number;
  isPaid: boolean;
  paidAt: string | null;
  paidAmount: number | null;
}

interface SalaryPayoutSummaryResponse {
  monthKey: string;
  from: string;
  to: string;
  drivers: SalaryPayoutSummaryRow[];
  managers: SalaryPayoutSummaryRow[];
}

const payoutMonth = ref<string>(new Date().toISOString().slice(0, 7));
const payoutSummary = ref<SalaryPayoutSummaryResponse | null>(null);
const payoutLoading = ref(false);
const payoutError = ref('');

const loadPayoutSummary = async () => {
  payoutLoading.value = true;
  payoutError.value = '';
  try {
    const monthKey = (payoutMonth.value || '').trim();
    const res = await axios.get('/api/v1/salaries/summary', { params: { month: monthKey } });
    payoutSummary.value = res.data as SalaryPayoutSummaryResponse;
  } catch (e: any) {
    payoutError.value = e?.response?.data?.message || 'Ошибка загрузки выплат';
    payoutSummary.value = null;
  } finally {
    payoutLoading.value = false;
  }
};

const markPaid = async (personType: SalaryPayoutPersonType, personId: string, amountAccrued: number) => {
  const monthKey = (payoutMonth.value || '').trim();
  if (!monthKey) return;

  if (!window.confirm('Отметить зарплату как выданную?')) return;

  payoutLoading.value = true;
  payoutError.value = '';
  try {
    await axios.post('/api/v1/salaries/payout', {
      monthKey,
      personType,
      personId,
      amount: Number(amountAccrued) || 0,
      paidAt: new Date().toISOString(),
    });
    await loadPayoutSummary();
  } catch (e: any) {
    payoutError.value = e?.response?.data?.message || 'Ошибка отметки выплаты';
  } finally {
    payoutLoading.value = false;
  }
};

const undoPaid = async (personType: SalaryPayoutPersonType, personId: string) => {
  const monthKey = (payoutMonth.value || '').trim();
  if (!monthKey) return;

  if (!window.confirm('Отменить отметку "выдано"?')) return;

  payoutLoading.value = true;
  payoutError.value = '';
  try {
    await axios.delete('/api/v1/salaries/payout', { params: { monthKey, personType, personId } });
    await loadPayoutSummary();
  } catch (e: any) {
    payoutError.value = e?.response?.data?.message || 'Ошибка отмены выплаты';
  } finally {
    payoutLoading.value = false;
  }
};

const driverRowsByPerson = computed<PersonSummaryRow[]>(() => {
  const map = new Map<string, PersonSummaryRow>();
  for (const r of driverRows.value) {
    const id = r.driverId || 'unknown';
    const name = r.driverName || null;
    const prev = map.get(id) || { id: r.driverId, name, totalSalary: 0 };
    prev.totalSalary += Number(r.driverSalary) || 0;
    map.set(id, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.totalSalary - a.totalSalary);
});

const managerRowsByPerson = computed<PersonSummaryRow[]>(() => {
  const map = new Map<string, PersonSummaryRow>();
  for (const r of managerRows.value) {
    const id = r.managerId || 'unknown';
    const name = r.managerName || null;
    const prev = map.get(id) || { id: r.managerId, name, totalSalary: 0 };
    prev.totalSalary += Number(r.managerSalary) || 0;
    map.set(id, prev);
  }
  return Array.from(map.values()).sort((a, b) => b.totalSalary - a.totalSalary);
});

type PeriodPreset = 'today' | 'week' | 'month';

const formatDateInput = (d: Date) => d.toISOString().slice(0, 10);

const applyPreset = async (target: 'driver' | 'manager', preset: PeriodPreset) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (preset === 'week') {
    const tmp = new Date(now);
    const day = tmp.getDay() || 7;
    if (day > 1) {
      tmp.setDate(tmp.getDate() - (day - 1));
    }
    start = tmp;
  } else if (preset === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }

  const fromStr = formatDateInput(start);
  const toStr = formatDateInput(end);

  if (target === 'driver') {
    driverFrom.value = fromStr;
    driverTo.value = toStr;
    await loadDriverSalaries();
  } else {
    managerFrom.value = fromStr;
    managerTo.value = toStr;
    await loadManagerSalaries();
  }
};

const loadDriverOptions = async () => {
  try {
    const res = await axios.get('/api/v1/drivers');
    driverOptions.value = (res.data?.drivers || []).map((d: any) => ({
      _id: d._id,
      fullName: String(d.fullName || ''),
    }));
  } catch {
    driverOptions.value = [];
  }
};

const loadDriverSalaries = async () => {
  driverLoading.value = true;
  driverError.value = '';
  try {
    const params: any = {};
    if (driverFrom.value) params.from = driverFrom.value;
    if (driverTo.value) params.to = driverTo.value;
    if (driverId.value) params.driverId = driverId.value;

    const res = await axios.get('/api/v1/reports/driver-salaries', { params });
    driverRows.value = res.data?.rows || [];
    driverSummary.value = res.data?.summary || { totalDelivery: 0, totalSalary: 0 };
  } catch (e: any) {
    driverError.value = e?.response?.data?.message || 'Ошибка загрузки отчёта по водителям';
  } finally {
    driverLoading.value = false;
  }
};

const loadManagerSalaries = async () => {
  managerLoading.value = true;
  managerError.value = '';
  try {
    const params: any = {};
    if (managerFrom.value) params.from = managerFrom.value;
    if (managerTo.value) params.to = managerTo.value;
    if (managerId.value) params.userId = managerId.value;

    const res = await axios.get('/api/v1/reports/manager-salaries', { params });
    managerRows.value = res.data?.rows || [];
    managerSummary.value = res.data?.summary || { totalIncome: 0, totalSalary: 0 };
  } catch (e: any) {
    managerError.value = e?.response?.data?.message || 'Ошибка загрузки отчёта по менеджерам';
  } finally {
    managerLoading.value = false;
  }
};

onMounted(async () => {
  await loadDriverOptions();
  await loadDriverSalaries();
  await loadManagerSalaries();
  await loadPayoutSummary();
});
</script>
