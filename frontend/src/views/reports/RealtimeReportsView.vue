<template>
  <div class="h-full flex flex-col gap-4">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Отчёты в реальном времени</h1>
      <div class="flex gap-2 text-xs">
        <button
          v-for="option in periodOptions"
          :key="option.value"
          type="button"
          class="px-3 py-1 rounded border border-slate-700 hover:bg-slate-800"
          :class="period === option.value ? 'bg-sky-600 text-white border-sky-500' : 'text-slate-200'"
          @click="setPeriod(option.value)
          "
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
      <div
        class="border border-slate-800 rounded-xl bg-slate-950 p-4 flex flex-col items-center justify-center cursor-pointer hover:border-sky-500/80 transition-colors"
        @click="onIncomeClick"
      >
        <div class="text-sm text-slate-400 mb-2">Доходы</div>
        <div class="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
          <div class="w-full h-full rounded-full bg-gradient-to-tr from-emerald-600 via-sky-500 to-emerald-400 opacity-80" />
          <div class="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-slate-950 flex flex-col items-center justify-center border border-slate-800">
            <div class="text-[11px] text-slate-400">Всего доход</div>
            <div class="text-lg font-semibold">{{ totalIncomeFormatted }}</div>
          </div>
        </div>
        <div class="mt-4 w-full text-xs text-slate-300 space-y-1">
          <div class="flex justify-between">
            <span>Выручка от продажи</span>
            <span class="font-semibold">{{ salesIncomeFormatted }}</span>
          </div>
          <div class="flex justify-between">
            <span>Выручка от доставки</span>
            <span class="font-semibold">{{ deliveryIncomeFormatted }}</span>
          </div>
        </div>
      </div>

      <div class="border border-slate-800 rounded-xl bg-slate-950 p-4 flex flex-col items-center justify-center">
        <div class="text-sm text-slate-400 mb-2">Расходы</div>
        <div class="relative w-56 h-56 sm:w-72 sm:h-72 flex items-center justify-center">
          <div class="w-full h-full rounded-full bg-gradient-to-tr from-rose-600 via-amber-500 to-rose-400 opacity-80" />
          <div class="absolute w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-slate-950 flex flex-col items-center justify-center border border-slate-800">
            <div class="text-[11px] text-slate-400">Всего расходы</div>
            <div class="text-lg font-semibold">{{ totalExpensesFormatted }}</div>
          </div>
        </div>
        <div class="mt-4 w-full text-xs text-slate-300 space-y-1">
          <div class="flex justify-between">
            <span>Операционные</span>
            <span class="font-semibold">{{ operationalExpensesFormatted }}</span>
          </div>
          <div class="flex justify-between">
            <span>Водители</span>
            <span class="font-semibold">{{ driverExpensesFormatted }}</span>
          </div>
          <div class="flex justify-between">
            <span>Менеджеры</span>
            <span class="font-semibold">{{ managerExpensesFormatted }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
      <div v-if="showIncomeDetails" class="border border-slate-800 rounded-xl bg-slate-950 p-4 text-xs">
        <div class="font-semibold text-slate-200 mb-2">Подробности по доходам</div>
        <div class="text-slate-400 mb-2">Период: {{ currentPeriodLabel }}</div>
        <ul class="space-y-1 text-slate-300">
          <li class="flex justify-between">
            <span>Доход от товаров</span>
            <span class="font-semibold">{{ formatMoney(grossProfit || 0) }}</span>
          </li>
          <li class="flex justify-between">
            <span>Выручка от доставки</span>
            <span class="font-semibold">{{ deliveryIncomeFormatted }}</span>
          </li>
          <li class="flex justify-between">
            <span>Зарплата водителям (из доставки)</span>
            <span class="font-semibold">{{ driverExpensesFormatted }}</span>
          </li>
          <li class="flex justify-between">
            <span>Доход от доставки (выручка - зарплата водителям)</span>
            <span class="font-semibold">{{ deliveryNetIncomeFormatted }}</span>
          </li>
          <li class="flex justify-between border-t border-slate-800 pt-2 mt-2">
            <span>Всего доход</span>
            <span class="font-semibold">{{ totalIncomeFormatted }}</span>
          </li>
        </ul>
      </div>

      <div v-if="showExpensesDetails" class="border border-slate-800 rounded-xl bg-slate-950 p-4 text-xs">
        <div class="font-semibold text-slate-200 mb-2">Подробности по расходам</div>
        <div class="text-slate-400 mb-2">Период: {{ currentPeriodLabel }}</div>
        <ul class="space-y-1 text-slate-300">
          <li class="flex justify-between">
            <span>Операционные расходы</span>
            <span class="font-semibold">{{ operationalExpensesFormatted }}</span>
          </li>
          <li class="flex justify-between">
            <span>Расходы на водителей</span>
            <span class="font-semibold">{{ driverExpensesFormatted }}</span>
          </li>
          <li class="flex justify-between">
            <span>Расходы на менеджеров</span>
            <span class="font-semibold">{{ managerExpensesFormatted }}</span>
          </li>
          <li class="flex justify-between border-t border-slate-800 pt-2 mt-2">
            <span>Всего расходы</span>
            <span class="font-semibold">{{ totalExpensesFormatted }}</span>
          </li>
          <li class="flex justify-between border-t border-slate-800 pt-2 mt-2">
            <span>Чистая прибыль (доходы - расходы)</span>
            <span
              class="font-semibold"
              :class="netProfit >= 0 ? 'text-emerald-400' : 'text-red-300'"
            >
              {{ netProfitFormatted }}
            </span>
          </li>
        </ul>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2 text-xs">
      <div class="border border-slate-800 rounded-xl bg-slate-950 p-4">
        <div class="font-semibold text-slate-200 mb-2">Водители за период</div>
        <div v-if="driverPersons.length === 0" class="text-slate-400 text-[11px]">
          Нет данных по водителям за выбранный период.
        </div>
        <ul v-else class="space-y-1 text-slate-300">
          <li
            v-for="d in driverPersons"
            :key="d.id || d.name"
            class="flex justify-between"
          >
            <span>{{ d.name }}</span>
            <span class="font-semibold">{{ formatMoney(d.total) }}</span>
          </li>
        </ul>
      </div>

      <div class="border border-slate-800 rounded-xl bg-slate-950 p-4">
        <div class="font-semibold text-slate-200 mb-2">Менеджеры за период</div>
        <div v-if="managerPersons.length === 0" class="text-slate-400 text-[11px]">
          Нет данных по менеджерам за выбранный период.
        </div>
        <ul v-else class="space-y-1 text-slate-300">
          <li
            v-for="m in managerPersons"
            :key="m.id || m.name"
            class="flex justify-between"
          >
            <span>{{ m.name }}</span>
            <span class="font-semibold">{{ formatMoney(m.total) }}</span>
          </li>
        </ul>
      </div>
    </div>

    <div class="text-[11px] text-slate-500 mt-2">
      Данные на этой странице пока демонстрационные. Реальное подключение к финансовым отчётам будет
      выполнено отдельно.
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';

const router = useRouter();

const period = ref<'day' | 'week' | 'month' | 'year'>('day');
const showIncomeDetails = ref(true);
const showExpensesDetails = ref(true);

// Доходы
const salesIncome = ref(0);
const deliveryIncome = ref(0);
// Валовая прибыль по накладным (totalIncome из backend)
const grossProfit = ref(0);
const incomeLoading = ref(false);

// Расходы
const operationalExpenses = ref(0);
const driverExpenses = ref(0);
const managerExpenses = ref(0);
const expensesLoading = ref(false);

interface PersonExpenseRow {
  id: string | null;
  name: string;
  total: number;
}

const driverPersons = ref<PersonExpenseRow[]>([]);
const managerPersons = ref<PersonExpenseRow[]>([]);

const periodOptions = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
] as const;

const formatMoney = (value: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value || 0);
};

// Доход от доставки = выручка от доставки - расходы на водителей за период
const deliveryNetIncome = computed(
  () => (deliveryIncome.value || 0) - (driverExpenses.value || 0),
);

// Доход от товаров (как в накладных) + доход от доставки
// Это общий доход бизнеса за период
const totalIncome = computed(
  () => (grossProfit.value || 0) + (deliveryNetIncome.value || 0),
);

// Для отображения структуры расходов в круге показываем все расходы
const totalExpenses = computed(
  () =>
    (operationalExpenses.value || 0) +
    (driverExpenses.value || 0) +
    (managerExpenses.value || 0),
);

// Для чистой прибыли водители уже учтены в доходе доставки,
// поэтому здесь вычитаем только операционные и менеджеров
const totalExpensesForProfit = computed(
  () => (operationalExpenses.value || 0) + (managerExpenses.value || 0),
);

const netProfit = computed(
  () => totalIncome.value - totalExpensesForProfit.value,
);

const totalIncomeFormatted = computed(() => formatMoney(totalIncome.value));
const salesIncomeFormatted = computed(() => formatMoney(salesIncome.value || 0));
const deliveryIncomeFormatted = computed(() => formatMoney(deliveryIncome.value || 0));

const totalExpensesFormatted = computed(() => formatMoney(totalExpenses.value));
const operationalExpensesFormatted = computed(() => formatMoney(operationalExpenses.value || 0));
const driverExpensesFormatted = computed(() => formatMoney(driverExpenses.value || 0));
const managerExpensesFormatted = computed(() => formatMoney(managerExpenses.value || 0));
const deliveryNetIncomeFormatted = computed(() => formatMoney(deliveryNetIncome.value));
const netProfitFormatted = computed(() => formatMoney(netProfit.value));

const setPeriod = (value: 'day' | 'week' | 'month' | 'year') => {
  period.value = value;
};

const currentPeriodLabel = computed(() => {
  const found = periodOptions.find((p) => p.value === period.value);
  return found ? found.label : '';
});

const toggleIncomeDetails = () => {
  showIncomeDetails.value = !showIncomeDetails.value;
};

const toggleExpensesDetails = () => {
  showExpensesDetails.value = !showExpensesDetails.value;
};

const loadIncome = async () => {
  incomeLoading.value = true;
  try {
    const res = await axios.get('/api/v1/reports/realtime-income', {
      params: { period: period.value },
    });
    const data = res.data || {};
    const totals = data.totals || {};
    salesIncome.value = Number(totals.sales) || 0;
    deliveryIncome.value = Number(totals.delivery) || 0;
    grossProfit.value = Number(totals.income) || 0;
  } catch {
    salesIncome.value = 0;
    deliveryIncome.value = 0;
    grossProfit.value = 0;
  } finally {
    incomeLoading.value = false;
  }
};

const loadExpenses = async () => {
  expensesLoading.value = true;
  try {
    const res = await axios.get('/api/v1/reports/realtime-expenses', {
      params: { period: period.value },
    });
    const data = res.data || {};
    const totals = data.totals || {};
    operationalExpenses.value = Number(totals.operational) || 0;
    driverExpenses.value = Number(totals.drivers) || 0;
    managerExpenses.value = Number(totals.managers) || 0;
  } catch {
    operationalExpenses.value = 0;
    driverExpenses.value = 0;
    managerExpenses.value = 0;
  } finally {
    expensesLoading.value = false;
  }
};

const formatDateInput = (d: Date) => d.toISOString().slice(0, 10);

const getPeriodRange = () => {
  const now = new Date();
  let from = new Date(now);
  let to = new Date(now);

  if (period.value === 'week') {
    const tmp = new Date(now);
    const day = tmp.getDay() || 7;
    if (day > 1) {
      tmp.setDate(tmp.getDate() - (day - 1));
    }
    from = new Date(tmp.getFullYear(), tmp.getMonth(), tmp.getDate(), 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period.value === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else if (period.value === 'year') {
    from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  }

  return { from: formatDateInput(from), to: formatDateInput(to) };
};

const loadDriverAndManagerPersons = async () => {
  const { from, to } = getPeriodRange();

  try {
    const [driverRes, managerRes] = await Promise.all([
      axios.get('/api/v1/reports/driver-salaries', { params: { from, to } }),
      axios.get('/api/v1/reports/manager-salaries', { params: { from, to } }),
    ]);

    const driverRows = (driverRes.data?.rows || []) as Array<{
      driverId: string | null;
      driverName: string | null;
      driverSalary: number;
    }>;
    const managerRows = (managerRes.data?.rows || []) as Array<{
      managerId: string | null;
      managerName: string | null;
      managerSalary: number;
    }>;

    const driverMap = new Map<string, PersonExpenseRow>();
    for (const r of driverRows) {
      const id = r.driverId || 'unknown';
      const name = (r.driverName || 'Без водителя').trim();
      const prev = driverMap.get(id) || { id: r.driverId || null, name, total: 0 };
      prev.total += Number(r.driverSalary) || 0;
      driverMap.set(id, prev);
    }
    driverPersons.value = Array.from(driverMap.values()).sort((a, b) => b.total - a.total);

    const managerMap = new Map<string, PersonExpenseRow>();
    for (const r of managerRows) {
      const id = r.managerId || 'unknown';
      const name = (r.managerName || 'Без менеджера').trim();
      const prev = managerMap.get(id) || { id: r.managerId || null, name, total: 0 };
      prev.total += Number(r.managerSalary) || 0;
      managerMap.set(id, prev);
    }
    managerPersons.value = Array.from(managerMap.values()).sort((a, b) => b.total - a.total);
  } catch {
    driverPersons.value = [];
    managerPersons.value = [];
  }
};

onMounted(() => {
  loadIncome();
  loadExpenses();
  loadDriverAndManagerPersons();
});

watch(period, () => {
  loadIncome();
  loadExpenses();
  loadDriverAndManagerPersons();
});

const onIncomeClick = () => {
  toggleIncomeDetails();
  router.push({
    path: '/reports/invoices',
    query: { period: period.value },
  });
};

const onExpensesClick = () => {
  toggleExpensesDetails();
  router.push({
    path: '/reports/expenses',
    query: { period: period.value },
  });
};
</script>

<style scoped></style>
