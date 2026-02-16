<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">Водители</h1>
    </div>

    <!-- Добавить водителя -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 space-y-2">
      <div class="text-xs uppercase text-slate-400">Добавить водителя</div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          v-model="newDriver.fullName"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="ФИО"
        />
        <input
          v-model="newDriver.phone"
          type="text"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
          placeholder="Телефон"
        />
        <select
          v-model="newDriver.carId"
          class="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
        >
          <option value="">Без привязки к машине</option>
          <option
            v-for="car in cars"
            :key="car._id"
            :value="car._id"
          >
            {{ car.name }} ({{ car.plateNumber }})
          </option>
        </select>
      </div>
      <div class="flex items-center justify-between mt-2">
        <button
          type="button"
          class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
          :disabled="createLoading || !newDriver.fullName"
          @click="createDriver"
        >
          {{ createLoading ? 'Создание...' : 'Добавить водителя' }}
        </button>
        <div class="text-right text-[11px]">
          <div v-if="createError" class="text-red-400">{{ createError }}</div>
        </div>
      </div>
    </div>

    <!-- Список водителей -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200">
      <div class="text-xs uppercase text-slate-400 mb-2">Список водителей</div>
      <table class="min-w-full text-[11px]">
        <thead class="bg-slate-900 text-slate-300">
          <tr>
            <th class="px-2 py-1 text-left">ФИО</th>
            <th class="px-2 py-1 text-left">Телефон</th>
            <th class="px-2 py-1 text-left">Машина</th>
            <th class="px-2 py-1 text-center">Статус</th>
            <th class="px-2 py-1 text-right">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="d in drivers"
            :key="d._id"
            class="border-t border-slate-800"
          >
            <td class="px-2 py-1">
              <template v-if="editId === d._id">
                <input
                  v-model="editDriver.fullName"
                  type="text"
                  class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  placeholder="ФИО"
                />
              </template>
              <template v-else>
                {{ d.fullName }}
              </template>
            </td>
            <td class="px-2 py-1">
              <template v-if="editId === d._id">
                <input
                  v-model="editDriver.phone"
                  type="text"
                  class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                  placeholder="Телефон"
                />
              </template>
              <template v-else>
                {{ d.phone }}
              </template>
            </td>
            <td class="px-2 py-1">
              <template v-if="editId === d._id">
                <select
                  v-model="editDriver.carId"
                  class="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                >
                  <option value="">Без привязки к машине</option>
                  <option v-for="car in cars" :key="car._id" :value="car._id">
                    {{ car.name }} ({{ car.plateNumber }})
                  </option>
                </select>
              </template>
              <template v-else>
                <span v-if="d.car">
                  {{ d.car.name }} ({{ d.car.plateNumber }})
                </span>
                <span v-else class="text-slate-500">Не привязан</span>
              </template>
            </td>
            <td class="px-2 py-1 text-center">
              <span :class="d.isActive ? 'text-emerald-400' : 'text-slate-500'">
                {{ d.isActive ? 'Активен' : 'Не активен' }}
              </span>
            </td>
            <td class="px-2 py-1 text-right">
              <div class="flex items-center justify-end gap-2">
                <template v-if="editId === d._id">
                  <button
                    type="button"
                    class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="editLoading || !editDriver.fullName"
                    @click="saveEdit"
                  >
                    {{ editLoading ? 'Сохранение...' : 'Сохранить' }}
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="editLoading"
                    @click="cancelEdit"
                  >
                    Отмена
                  </button>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="deleteLoadingId === d._id || editLoading"
                    @click="startEdit(d)"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="deleteLoadingId === d._id || editLoading"
                    @click="deleteDriver(d)"
                  >
                    {{ deleteLoadingId === d._id ? 'Удаление...' : 'Удалить' }}
                  </button>
                </template>
              </div>
              <div v-if="editId === d._id && editError" class="mt-1 text-[11px] text-red-400">
                {{ editError }}
              </div>
            </td>
          </tr>
          <tr v-if="!drivers.length">
            <td colspan="5" class="px-2 py-3 text-center text-slate-400">Водители не добавлены</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';

interface CarOption {
  _id: string;
  name: string;
  plateNumber: string;
}

interface DriverItem {
  _id: string;
  fullName: string;
  phone?: string;
  isActive: boolean;
  car?: CarOption;
}

const drivers = ref<DriverItem[]>([]);
const cars = ref<CarOption[]>([]);

const loading = ref(false);
const createLoading = ref(false);
const createError = ref('');

const editId = ref<string | null>(null);
const editLoading = ref(false);
const editError = ref('');
const editDriver = ref<{ fullName: string; phone: string; carId: string | '' }>({
  fullName: '',
  phone: '',
  carId: '',
});

const deleteLoadingId = ref<string | null>(null);

const newDriver = ref<{ fullName: string; phone: string; carId: string | '' }>(
  {
    fullName: '',
    phone: '',
    carId: '',
  }
);

const loadDrivers = async () => {
  loading.value = true;
  try {
    const res = await axios.get('/api/v1/drivers');
    drivers.value = res.data?.drivers || [];
  } finally {
    loading.value = false;
  }
};

const startEdit = (d: DriverItem) => {
  editError.value = '';
  editId.value = d._id;
  editDriver.value = {
    fullName: String(d.fullName || ''),
    phone: String(d.phone || ''),
    carId: d.car?._id || '',
  };
};

const cancelEdit = () => {
  editId.value = null;
  editError.value = '';
  editLoading.value = false;
  editDriver.value = { fullName: '', phone: '', carId: '' };
};

const saveEdit = async () => {
  if (!editId.value) return;
  editLoading.value = true;
  editError.value = '';
  try {
    const payload: any = {
      fullName: editDriver.value.fullName,
      phone: editDriver.value.phone || undefined,
      carId: editDriver.value.carId ? editDriver.value.carId : null,
    };
    const res = await axios.put(`/api/v1/drivers/${editId.value}`, payload);
    const updated = res.data?.driver as DriverItem;
    const idx = drivers.value.findIndex((x) => x._id === editId.value);
    if (idx !== -1) {
      drivers.value[idx] = updated;
    }
    cancelEdit();
  } catch (e: any) {
    editError.value = e?.response?.data?.message || 'Ошибка сохранения водителя';
  } finally {
    editLoading.value = false;
  }
};

const deleteDriver = async (d: DriverItem) => {
  const ok = window.confirm(`Удалить водителя "${d.fullName}"?`);
  if (!ok) return;
  deleteLoadingId.value = d._id;
  try {
    const res = await axios.delete(`/api/v1/drivers/${d._id}`);
    const updated = res.data?.driver as DriverItem;
    const idx = drivers.value.findIndex((x) => x._id === d._id);
    if (idx !== -1) {
      drivers.value[idx] = updated;
    }
    if (editId.value === d._id) {
      cancelEdit();
    }
  } catch (e: any) {
    window.alert(e?.response?.data?.message || 'Ошибка удаления водителя');
  } finally {
    deleteLoadingId.value = null;
  }
};

const loadCars = async () => {
  const res = await axios.get('/api/v1/cars');
  cars.value = res.data?.cars || [];
};

const createDriver = async () => {
  createLoading.value = true;
  createError.value = '';
  try {
    const payload: any = {
      fullName: newDriver.value.fullName,
      phone: newDriver.value.phone || undefined,
      carId: newDriver.value.carId || undefined,
    };
    const res = await axios.post('/api/v1/drivers', payload);
    drivers.value.unshift(res.data.driver as DriverItem);
    newDriver.value = { fullName: '', phone: '', carId: '' };
  } catch (e: any) {
    createError.value = e?.response?.data?.message || 'Ошибка создания водителя';
  } finally {
    createLoading.value = false;
  }
};

onMounted(() => {
  loadDrivers();
  loadCars();
});
</script>
