<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Автопарк</h1>
    </div>

    <!-- Добавить автомобиль -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 space-y-2">
      <div class="text-xs uppercase text-slate-400">Добавить автомобиль</div>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          v-model="newCar.name"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Название (например, Газель #1)"
        />
        <input
          v-model="newCar.plateNumber"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Госномер"
        />
        <input
          v-model="newCar.brand"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Марка"
        />
        <input
          v-model="newCar.model"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Модель"
        />
      </div>
      <div class="grid grid-cols-1 md:grid-cols-5 gap-2 mt-2">
        <input
          v-model.number="newCar.year"
          type="number"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Год выпуска"
        />
        <input
          v-model="newCar.vin"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="VIN (необязательно)"
        />
        <input
          v-model.number="newCar.oilChangeIntervalKm"
          type="number"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Интервал замены масла, км"
        />
        <input
          v-model.number="newCar.currentOdometer"
          type="number"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Текущий пробег, км"
        />
        <input
          v-model.number="newCar.lastOilChangeOdometer"
          type="number"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Пробег при последней замене масла, км"
        />
        <div class="flex items-center gap-1">
          <input
            v-model.number="newCar.driverSharePercent"
            type="number"
            min="0"
            max="100"
            step="1"
            class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-full"
            placeholder="Процент водителя от доставки, %"
          />
          <span class="text-[11px] text-slate-400">%</span>
        </div>
      </div>
      <div class="flex items-center justify-between mt-2">
        <button
          type="button"
          class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="createLoading || !newCar.name || !newCar.plateNumber"
          @click="createCar"
        >
          {{ createLoading ? 'Создание...' : 'Добавить автомобиль' }}
        </button>
        <div class="text-right text-[11px]">
          <div v-if="createError" class="text-red-400">{{ createError }}</div>
        </div>
      </div>
    </div>

    <!-- Список автомобилей и расходы -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200">
        <div class="text-xs uppercase text-slate-400 mb-2">Список автомобилей</div>
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Название</th>
              <th class="px-2 py-1 text-left">Госномер</th>
              <th class="px-2 py-1 text-left">Марка/модель</th>
              <th class="px-2 py-1 text-right">Пробег, км</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="car in cars"
              :key="car._id"
              class="border-t border-slate-800 cursor-pointer hover:bg-slate-800/60"
              :class="{ 'bg-slate-800/80': selectedCar && selectedCar._id === car._id }"
              @click="selectCar(car)"
            >
              <td class="px-2 py-1">{{ car.name }}</td>
              <td class="px-2 py-1">{{ car.plateNumber }}</td>
              <td class="px-2 py-1">{{ car.brand }} {{ car.model }}</td>
              <td class="px-2 py-1 text-right">{{ car.currentOdometer ?? '-' }}</td>
            </tr>
            <tr v-if="!cars.length">
              <td colspan="4" class="px-2 py-3 text-center text-slate-400">Автомобили не добавлены</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs uppercase text-slate-400">Расходы по автомобилю</div>
          <div v-if="selectedCar" class="text-[11px] text-slate-300">
            {{ selectedCar.name }} ({{ selectedCar.plateNumber }})
          </div>
        </div>

        <div v-if="!selectedCar" class="text-slate-400 text-xs">
          Выберите автомобиль слева, чтобы увидеть расходы.
        </div>

        <template v-else>
          <!-- Редактирование характеристик автомобиля -->
          <div class="mb-3 text-[11px] space-y-2 border-b border-slate-800 pb-2">
            <div class="flex items-center justify-between">
              <div class="text-slate-400 uppercase">Характеристики автомобиля</div>
              <span class="text-[10px]" :class="selectedCar.isActive ? 'text-emerald-400' : 'text-slate-500'">
                {{ selectedCar.isActive ? 'Активен' : 'Не активен' }}
              </span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                v-model="editCar.name"
                type="text"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Название"
              />
              <input
                v-model="editCar.plateNumber"
                type="text"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Госномер"
              />
              <input
                v-model="editCar.brand"
                type="text"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Марка"
              />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                v-model="editCar.model"
                type="text"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Модель"
              />
              <input
                v-model.number="editCar.currentOdometer"
                type="number"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Текущий пробег, км"
              />
              <input
                v-model.number="editCar.oilChangeIntervalKm"
                type="number"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Интервал замены масла, км"
              />
              <div class="flex items-center gap-1">
                <input
                  v-model.number="editCar.driverSharePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-full"
                  placeholder="Процент водителя от доставки, %"
                />
                <span class="text-[11px] text-slate-400">%</span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-1">
              <button
                type="button"
                class="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="saveCarLoading || !editCar.name || !editCar.plateNumber"
                @click="saveCar"
              >
                {{ saveCarLoading ? 'Сохранение...' : 'Сохранить изменения' }}
              </button>
              <button
                type="button"
                class="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="deleteCarLoading || !selectedCar.isActive"
                @click="deactivateCar"
              >
                {{ deleteCarLoading ? 'Удаление...' : 'Удалить автомобиль' }}
              </button>
            </div>
          </div>

          <!-- Информация по замене масла и краткий итог по расходам -->
          <div class="mb-3 text-[11px] space-y-1">
            <div class="text-slate-300">
              <span class="text-slate-400">Интервал замены масла:</span>
              <span class="ml-1">{{ selectedCar.oilChangeIntervalKm || 10000 }} км</span>
            </div>
            <div class="text-slate-300">
              <span class="text-slate-400">Пробег при последней замене:</span>
              <span class="ml-1">{{ selectedCar.lastOilChangeOdometer ?? 0 }} км</span>
            </div>
            <div class="text-slate-300">
              <span class="text-slate-400">Текущий пробег:</span>
              <span class="ml-1">{{ selectedCar.currentOdometer ?? '-' }} км</span>
            </div>
            <div class="text-slate-300">
              <span class="text-slate-400">До следующей замены масла:</span>
              <span
                class="ml-1"
                :class="{
                  'text-emerald-400': oilChangeInfo.kmLeft > 2000,
                  'text-amber-400': oilChangeInfo.kmLeft <= 2000 && oilChangeInfo.kmLeft > 0,
                  'text-red-400': oilChangeInfo.kmLeft <= 0,
                }"
              >
                {{ oilChangeInfo.text }}
              </span>
            </div>
            <div class="text-slate-400 pt-1 border-t border-slate-800 mt-2 flex flex-wrap gap-4">
              <span>
                Всего расходов: <span class="text-slate-200">{{ totals.total.toFixed(2) }}</span>
              </span>
              <span>
                ГСМ: <span class="text-slate-200">{{ totals.fuel.toFixed(2) }}</span>
              </span>
            </div>
          </div>

          <!-- Добавить расход -->
          <div class="space-y-2 mb-3">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                v-model="newExpense.date"
                type="date"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
              />
              <select
                v-model="newExpense.type"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
              >
                <option value="fuel">ГСМ</option>
                <option value="service">ТО / ремонт</option>
                <option value="fine">Штраф ГАИ</option>
                <option value="insurance">Страховка</option>
                <option value="tax">Налог</option>
                <option value="other">Другое</option>
              </select>
              <input
                v-model.number="newExpense.amount"
                type="number"
                step="0.01"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Сумма"
              />
              <input
                v-model.number="newExpense.odometer"
                type="number"
                class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                placeholder="Пробег, км"
              />
            </div>
            <input
              v-model="newExpense.description"
              type="text"
              class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs w-full"
              placeholder="Комментарий (АЗС, вид работ, страховая и т.п.)"
            />
            <button
              type="button"
              class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="expenseLoading || !newExpense.date || !newExpense.type || !newExpense.amount"
              @click="createExpense"
            >
              {{ expenseLoading ? 'Сохранение...' : 'Добавить расход' }}
            </button>
          </div>

          <!-- Таблица расходов -->
          <table class="min-w-full text-[11px]">
            <thead class="bg-slate-900 text-slate-300">
              <tr>
                <th class="px-2 py-1 text-left">Дата</th>
                <th class="px-2 py-1 text-left">Тип</th>
                <th class="px-2 py-1 text-right">Сумма</th>
                <th class="px-2 py-1 text-right">Пробег, км</th>
                <th class="px-2 py-1 text-left">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="exp in expenses" :key="exp._id" class="border-t border-slate-800">
                <td class="px-2 py-1">{{ formatDate(exp.date) }}</td>
                <td class="px-2 py-1">{{ expenseTypeLabel(exp.type) }}</td>
                <td class="px-2 py-1 text-right">{{ exp.amount.toFixed(2) }}</td>
                <td class="px-2 py-1 text-right">{{ exp.odometer ?? '-' }}</td>
                <td class="px-2 py-1">{{ exp.description }}</td>
              </tr>
              <tr v-if="!expenses.length">
                <td colspan="5" class="px-2 py-3 text-center text-slate-400">Расходы ещё не добавлены</td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

interface Car {
  _id: string;
  name: string;
  plateNumber: string;
  brand?: string;
  model?: string;
  year?: number;
  vin?: string;
  oilChangeIntervalKm?: number;
  lastOilChangeOdometer?: number;
  currentOdometer?: number;
  isActive?: boolean;
  driverSharePercent?: number;
}

interface CarExpense {
  _id: string;
  date: string;
  type: 'fuel' | 'service' | 'fine' | 'insurance' | 'tax' | 'other';
  amount: number;
  description?: string;
  odometer?: number;
}

const cars = ref<Car[]>([]);
const selectedCar = ref<Car | null>(null);
const expenses = ref<CarExpense[]>([]);

const loading = ref(false);
const createLoading = ref(false);
const createError = ref('');
const expenseLoading = ref(false);
const saveCarLoading = ref(false);
const deleteCarLoading = ref(false);

const editCar = ref<{
  name: string;
  plateNumber: string;
  brand?: string;
  model?: string;
  currentOdometer?: number | null;
  oilChangeIntervalKm?: number | null;
  driverSharePercent?: number | null; // в процентах, для удобства редактирования
}>(
  {
    name: '',
    plateNumber: '',
    brand: '',
    model: '',
    currentOdometer: null,
    oilChangeIntervalKm: null,
    driverSharePercent: null,
  }
);

const newCar = ref<{
  name: string;
  plateNumber: string;
  brand?: string;
  model?: string;
  year?: number | null;
  vin?: string;
  oilChangeIntervalKm?: number | null;
  currentOdometer?: number | null;
  lastOilChangeOdometer?: number | null;
   driverSharePercent?: number | null;
}>(
  {
    name: '',
    plateNumber: '',
    brand: '',
    model: '',
    year: null,
    vin: '',
    oilChangeIntervalKm: 10000,
    currentOdometer: null,
    lastOilChangeOdometer: null,
    driverSharePercent: 0.5,
  }
);

const newExpense = ref<{ date: string; type: CarExpense['type']; amount: number | null; description: string; odometer: number | null }>(
  {
    date: new Date().toISOString().slice(0, 10),
    type: 'fuel',
    amount: null,
    description: '',
    odometer: null,
  }
);

const loadCars = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v1/cars');
    cars.value = res.data?.cars || [];
  } finally {
    loading.value = false;
  }
};

const selectCar = async (car: Car) => {
  selectedCar.value = car;
  editCar.value = {
    name: car.name,
    plateNumber: car.plateNumber,
    brand: car.brand,
    model: car.model,
    currentOdometer: car.currentOdometer ?? null,
    oilChangeIntervalKm: car.oilChangeIntervalKm ?? null,
    driverSharePercent:
      typeof car.driverSharePercent === 'number' && !Number.isNaN(car.driverSharePercent)
        ? Math.round(car.driverSharePercent * 100)
        : null,
  };
  await loadExpenses(car._id);
};

const loadExpenses = async (carId: string) => {
  const res = await axios.get(`/api/v1/cars/${carId}/expenses`);
  expenses.value = res.data?.expenses || [];
};

const createCar = async () => {
  createLoading.value = true;
  createError.value = '';
  try {
    const payload: any = { ...newCar.value };
    if (!payload.year) delete payload.year;
    if (!payload.oilChangeIntervalKm) delete payload.oilChangeIntervalKm;
    if (!payload.currentOdometer) delete payload.currentOdometer;
    if (!payload.lastOilChangeOdometer) delete payload.lastOilChangeOdometer;
    // конвертируем процент в долю перед отправкой
    if (typeof payload.driverSharePercent === 'number' && !Number.isNaN(payload.driverSharePercent)) {
      payload.driverSharePercent = payload.driverSharePercent / 100;
    } else {
      delete payload.driverSharePercent;
    }

    const res = await axios.post('/api/v1/cars', payload);
    cars.value.unshift(res.data.car);
    newCar.value = {
      name: '',
      plateNumber: '',
      brand: '',
      model: '',
      year: null,
      vin: '',
      oilChangeIntervalKm: 10000,
      currentOdometer: null,
      lastOilChangeOdometer: null,
      driverSharePercent: 50,
    };
  } catch (e: any) {
    createError.value = e?.response?.data?.message || 'Ошибка создания автомобиля';
  } finally {
    createLoading.value = false;
  }
};

const createExpense = async () => {
  if (!selectedCar.value) return;
  expenseLoading.value = true;
  try {
    const payload: any = { ...newExpense.value };
    if (!payload.odometer) delete payload.odometer;

    const res = await axios.post(`/api/v1/cars/${selectedCar.value._id}/expenses`, payload);
    expenses.value.unshift(res.data.expense);

    // обновим пробег у машины, если был указан
    if (payload.odometer) {
      selectedCar.value.currentOdometer = payload.odometer;
    }

    newExpense.value = {
      date: new Date().toISOString().slice(0, 10),
      type: 'fuel',
      amount: null,
      description: '',
      odometer: null,
    };
  } finally {
    expenseLoading.value = false;
  }
};

const formatDate = (value: string) => {
  if (!value) return '';
  return value.slice(0, 10);
};

const expenseTypeLabel = (type: CarExpense['type']) => {
  switch (type) {
    case 'fuel':
      return 'ГСМ';
    case 'service':
      return 'ТО / ремонт';
    case 'fine':
      return 'Штраф ГАИ';
    case 'insurance':
      return 'Страховка';
    case 'tax':
      return 'Налог';
    default:
      return 'Другое';
  }
};

const totals = computed(() => {
  let total = 0;
  let fuel = 0;
  for (const e of expenses.value) {
    total += e.amount || 0;
    if (e.type === 'fuel') fuel += e.amount || 0;
  }
  return { total, fuel };
});

const oilChangeInfo = computed(() => {
  const car = selectedCar.value;
  if (!car) {
    return { kmLeft: 0, text: '-' };
  }
  const interval = car.oilChangeIntervalKm || 10000;
  const last = car.lastOilChangeOdometer ?? 0;
  const current = car.currentOdometer ?? 0;
  const nextAt = last + interval;
  const kmLeft = nextAt - current;

  if (kmLeft <= 0) {
    return { kmLeft, text: 'Пора менять масло' };
  }
  return { kmLeft, text: `осталось ~${kmLeft} км` };
});

const saveCar = async () => {
  if (!selectedCar.value) return;
  saveCarLoading.value = true;
  try {
    const payload: any = { ...editCar.value };
    if (!payload.currentOdometer) delete payload.currentOdometer;
    if (!payload.oilChangeIntervalKm) delete payload.oilChangeIntervalKm;
    // конвертируем процент в долю перед отправкой
    if (typeof payload.driverSharePercent === 'number' && !Number.isNaN(payload.driverSharePercent)) {
      payload.driverSharePercent = payload.driverSharePercent / 100;
    } else {
      delete payload.driverSharePercent;
    }

    const res = await axios.put(`/api/v1/cars/${selectedCar.value._id}`, payload);
    const updated: Car = res.data.car;

    // обновляем в списке
    const idx = cars.value.findIndex((c) => c._id === updated._id);
    if (idx !== -1) {
      cars.value[idx] = updated;
    }
    selectedCar.value = updated;
  } finally {
    saveCarLoading.value = false;
  }
};

const deactivateCar = async () => {
  if (!selectedCar.value) return;
  deleteCarLoading.value = true;
  try {
    const res = await axios.delete(`/api/v1/cars/${selectedCar.value._id}`);
    const deletedId: string = res.data.car?._id || selectedCar.value._id;
    const idx = cars.value.findIndex((c) => c._id === deletedId);
    if (idx !== -1) {
      cars.value.splice(idx, 1);
    }
    selectedCar.value = null;
  } finally {
    deleteCarLoading.value = false;
  }
};

onMounted(() => {
  loadCars();
});
</script>
