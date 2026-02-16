<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <h1 class="text-xl font-semibold">P&amp;L по продажам</h1>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1 text-[11px] flex-1 min-w-[260px]">
          <div class="flex items-center gap-2 flex-wrap no-print">
            <div class="flex items-center gap-1">
              <span class="text-slate-400">Период:</span>
              <input
                v-model="from"
                type="date"
                class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
              />
              <span class="text-slate-400">—</span>
              <input
                v-model="to"
                type="date"
                class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
              />
            </div>
            <div class="flex items-center gap-1">
              <span class="text-slate-400">Группировка:</span>
              <select
                v-model="groupBy"
                class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
              >
                <option value="day">По дням</option>
                <option value="month">По месяцам</option>
              </select>
            </div>
            <button
              type="button"
              class="px-3 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white disabled:opacity-60"
              :disabled="loading"
              @click="reloadAll"
            >
              {{ loading ? 'Загрузка...' : 'Показать' }}
            </button>
            <button
              type="button"
              class="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs text-white"
              @click="onPrint"
            >
              Печать
            </button>
          </div>
          <div class="flex items-center gap-1 flex-wrap no-print">
            <span class="text-slate-400">Быстрый период:</span>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('today')"
            >
              Сегодня
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('week')"
            >
              Неделя
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('month')"
            >
              Месяц
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('year')"
            >
              Год
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800"
              @click="setPreset('prevYear')"
            >
              Прошлый год
            </button>
            <button
              type="button"
              class="px-2 py-0.5 rounded border border-slate-700 hover:bg-slate-800 text-slate-300"
              @click="clearPreset"
            >
              Сброс
            </button>
          </div>
        </div>
        <div class="text-[11px] text-slate-400 max-w-xl">
          Баланс за период: пришло = доход по накладным (totalIncome) + чистая прибыль от доставок.
          Ушло = выданные зарплаты + расходы на машину + операционные расходы.
          Осталось = пришло - ушло.
        </div>
      </div>

      <div v-if="error" class="text-xs text-red-400">{{ error }}</div>

      <div v-if="summary" class="grid grid-cols-1 md:grid-cols-6 gap-3 text-[11px] mt-2">
        <div>
          <div class="text-slate-400">Выручка всего</div>
          <div class="text-emerald-400 text-sm font-semibold">
            {{ formatMoney(summary.totalSales) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Выручка товаров</div>
          <div class="text-slate-100 text-sm font-semibold">
            {{ formatMoney(summary.totalGoodsRevenue) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Выручка доставок</div>
          <div class="text-slate-100 text-sm font-semibold">
            {{ formatMoney(summary.totalDeliveryRevenue) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">ЗП водителя от доставок (начислено)</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalDriverDeliverySalaryAccrued || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Чистая прибыль от доставок</div>
          <div class="text-emerald-400 text-sm font-semibold">
            {{ formatMoney(summary.totalDeliveryNetProfit || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Валовая прибыль (товары)</div>
          <div class="text-amber-300 text-sm font-semibold">
            {{ formatMoney(summary.totalGoodsGrossProfit) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">НАШ СКЛАД: выручка</div>
          <div class="text-slate-100 text-sm font-semibold">
            {{ formatMoney(summary.totalWarehouseRevenue || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">НАШ СКЛАД: доход</div>
          <div class="text-amber-300 text-sm font-semibold">
            {{ formatMoney(summary.totalWarehouseGrossProfit || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">НАШ СКЛАД: чистая прибыль</div>
          <div class="text-sm font-semibold" :class="(summary.totalWarehouseNetProfitAllocated || 0) >= 0 ? 'text-emerald-400' : 'text-red-300'">
            {{ formatMoney(summary.totalWarehouseNetProfitAllocated || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Средний чек по накладной</div>
          <div class="text-slate-100 text-sm font-semibold">
            {{ formatMoney(avgCheck) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Операционные расходы</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalOperatingExpenses || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Зарплаты выданы</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalSalaryPaid || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">ЗП выданы водителям</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalSalaryPaidDrivers || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">ЗП выданы менеджерам</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalSalaryPaidManagers || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Расходы на машину</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalCarExpenses || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Пришло (доход + доставка чистыми)</div>
          <div class="text-emerald-400 text-sm font-semibold">
            {{ formatMoney(summary.totalCameIn || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Ушло (всего)</div>
          <div class="text-red-300 text-sm font-semibold">
            {{ formatMoney(summary.totalWentOut || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Осталось</div>
          <div
            class="text-sm font-semibold"
            :class="(summary.totalRemaining || 0) >= 0 ? 'text-emerald-400' : 'text-red-300'"
          >
            {{ formatMoney(summary.totalRemaining || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Чистая прибыль (товары - опер.расходы)</div>
          <div
            class="text-sm font-semibold"
            :class="(summary.totalNetProfit || 0) >= 0 ? 'text-emerald-400' : 'text-red-300'"
          >
            {{ formatMoney(summary.totalNetProfit || 0) }} ₽
          </div>
        </div>
        <div>
          <div class="text-slate-400">Маржа по товарам, %</div>
          <div class="text-sm font-semibold" :class="totalMargin >= 0 ? 'text-emerald-400' : 'text-red-300'">
            {{ totalMargin.toFixed(1) }} %
          </div>
        </div>
      </div>
      <div v-if="summary && summary.expenseByCategory && summary.expenseByCategory.length" class="mt-2 text-[11px]">
        <div class="text-slate-400 mb-1">Структура операционных расходов за период:</div>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="cat in summary.expenseByCategory"
            :key="cat.category"
            class="px-2 py-1 rounded border border-slate-800 bg-slate-900"
          >
            <span class="text-slate-300">{{ humanCategory(cat.category) }}:</span>
            <span class="text-red-300 font-semibold"> {{ formatMoney(cat.total) }} ₽</span>
          </div>
        </div>
      </div>
    </div>

    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200">
      <div class="text-[11px] text-slate-400 mb-2">По периодам</div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Период</th>
              <th class="px-2 py-1 text-right">Накладных</th>
              <th class="px-2 py-1 text-right">Выручка всего</th>
              <th class="px-2 py-1 text-right">Товары</th>
              <th class="px-2 py-1 text-right">Доставки</th>
              <th class="px-2 py-1 text-right">Валовая прибыль (товары)</th>
              <th class="px-2 py-1 text-right">НАШ СКЛАД выручка</th>
              <th class="px-2 py-1 text-right">НАШ СКЛАД доход</th>
              <th class="px-2 py-1 text-right">НАШ СКЛАД чистыми</th>
              <th class="px-2 py-1 text-right">Пришло</th>
              <th class="px-2 py-1 text-right">ЗП водителя (доставки)</th>
              <th class="px-2 py-1 text-right">Доставка чистыми</th>
              <th class="px-2 py-1 text-right">Зарплаты</th>
              <th class="px-2 py-1 text-right">Водители</th>
              <th class="px-2 py-1 text-right">Менеджеры</th>
              <th class="px-2 py-1 text-right">Авто</th>
              <th class="px-2 py-1 text-right">Опер.расходы</th>
              <th class="px-2 py-1 text-right">Ушло</th>
              <th class="px-2 py-1 text-right">Осталось</th>
              <th class="px-2 py-1 text-right">Чистая прибыль</th>
              <th class="px-2 py-1 text-right">Маржа, %</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.period"
              class="border-t border-slate-800"
            >
              <td class="px-2 py-1">{{ row.period }}</td>
              <td class="px-2 py-1 text-right">{{ row.invoiceCount }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.salesTotal) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.goodsRevenue) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.deliveryRevenue) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.goodsGrossProfit) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.warehouseRevenue || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.warehouseGrossProfit || 0) }}</td>
              <td class="px-2 py-1 text-right" :class="(row.warehouseNetProfitAllocated || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'">
                {{ formatMoney(row.warehouseNetProfitAllocated || 0) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.cameIn || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.driverDeliverySalaryAccrued || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.deliveryNetProfit || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.salaryPaid || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.salaryPaidDrivers || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.salaryPaidManagers || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.carExpenses || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.operatingExpenses || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(row.wentOut || 0) }}</td>
              <td class="px-2 py-1 text-right" :class="(row.remaining || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'">
                {{ formatMoney(row.remaining || 0) }}
              </td>
              <td
                class="px-2 py-1 text-right"
                :class="(row.netProfit || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'"
              >
                {{ formatMoney(row.netProfit || 0) }}
              </td>
              <td class="px-2 py-1 text-right">
                {{ computeMargin(row) }}
              </td>
            </tr>
            <tr v-if="!loading && rows.length === 0">
              <td colspan="7" class="px-2 py-3 text-center text-slate-400">Нет данных за выбранный период.</td>
            </tr>
            <tr v-if="summary" class="border-t border-slate-700 bg-slate-900/60 font-semibold">
              <td class="px-2 py-1 text-left">Итого</td>
              <td class="px-2 py-1 text-right">{{ summary.totalInvoices }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalSales) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalGoodsRevenue) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalDeliveryRevenue) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalGoodsGrossProfit) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalWarehouseRevenue || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalWarehouseGrossProfit || 0) }}</td>
              <td class="px-2 py-1 text-right" :class="(summary.totalWarehouseNetProfitAllocated || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'">
                {{ formatMoney(summary.totalWarehouseNetProfitAllocated || 0) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalCameIn || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalDriverDeliverySalaryAccrued || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalDeliveryNetProfit || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalSalaryPaid || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalSalaryPaidDrivers || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalSalaryPaidManagers || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalCarExpenses || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalOperatingExpenses || 0) }}</td>
              <td class="px-2 py-1 text-right">{{ formatMoney(summary.totalWentOut || 0) }}</td>
              <td class="px-2 py-1 text-right" :class="(summary.totalRemaining || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'">
                {{ formatMoney(summary.totalRemaining || 0) }}
              </td>
              <td class="px-2 py-1 text-right" :class="(summary.totalNetProfit || 0) >= 0 ? 'text-emerald-300' : 'text-red-300'">
                {{ formatMoney(summary.totalNetProfit || 0) }}
              </td>
              <td class="px-2 py-1 text-right">{{ totalMargin >= 0 ? totalMargin.toFixed(1) + ' %' : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Операционные расходы за период -->
    <div class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-200 space-y-3">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="font-semibold text-sm">Операционные расходы за период</div>
        <div class="text-[11px] text-slate-400">
          Используются в расчёте чистой прибыли. Здесь можно добавлять/удалять расходы.
        </div>
      </div>

      <div class="flex flex-wrap items-end gap-3 mt-1">
        <div class="flex items-center gap-1 text-[11px]">
          <span class="text-slate-400">Дата:</span>
          <input
            v-model="newExpenseDate"
            type="date"
            class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          />
        </div>
        <div class="flex items-center gap-1 text-[11px]">
          <span class="text-slate-400">Статья:</span>
          <select
            v-model="newExpenseCategory"
            class="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          >
            <option value="rent">Аренда</option>
            <option value="salary">Зарплаты</option>
            <option value="fuel">Топливо</option>
            <option value="carService">Авто (ремонт/сервис)</option>
            <option value="utilities">Коммунальные / связь</option>
            <option value="marketing">Маркетинг</option>
            <option value="taxes">Налоги/взносы</option>
            <option value="other">Другое</option>
          </select>
        </div>
        <div class="flex items-center gap-1 text-[11px]">
          <span class="text-slate-400">Сумма:</span>
          <input
            v-model.number="newExpenseAmount"
            type="number"
            step="0.01"
            class="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-right"
          />
          <span class="text-slate-400">₽</span>
        </div>
        <div class="flex-1 min-w-[180px]">
          <input
            v-model="newExpenseDescription"
            type="text"
            placeholder="Комментарий (аренда за декабрь, связь, и т.п.)"
            class="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px]"
          />
        </div>
        <div>
          <button
            type="button"
            class="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-xs text-white disabled:opacity-60"
            :disabled="expenseSaving || !canCreateExpense"
            @click="createExpense"
          >
            {{ expenseSaving ? 'Сохранение...' : 'Добавить расход' }}
          </button>
        </div>
      </div>

      <div v-if="expensesError" class="text-xs text-red-400">{{ expensesError }}</div>

      <div class="mt-2 border border-slate-800 rounded-lg overflow-x-auto max-h-80">
        <table class="min-w-full text-[11px]">
          <thead class="bg-slate-900 text-slate-300">
            <tr>
              <th class="px-2 py-1 text-left">Дата</th>
              <th class="px-2 py-1 text-left">Статья</th>
              <th class="px-2 py-1 text-left">Комментарий</th>
              <th class="px-2 py-1 text-right">Сумма</th>
              <th class="px-2 py-1 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="exp in expenses"
              :key="exp._id"
              class="border-t border-slate-800"
            >
              <td class="px-2 py-1">{{ new Date(exp.date).toLocaleDateString('ru-RU') }}</td>
              <td class="px-2 py-1">{{ humanCategory(exp.category) }}</td>
              <td class="px-2 py-1 truncate max-w-[260px]" :title="exp.description || ''">
                {{ exp.description || '' }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatMoney(exp.amount) }}</td>
              <td class="px-2 py-1 text-right">
                <button
                  type="button"
                  class="px-2 py-1 rounded bg-red-700 hover:bg-red-600 text-[11px] text-white"
                  @click="deleteExpense(exp)"
                >
                  Удалить
                </button>
              </td>
            </tr>
            <tr v-if="!expensesLoading && expenses.length === 0">
              <td colspan="5" class="px-2 py-3 text-center text-slate-400">Расходы за выбранный период не найдены.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import axios from 'axios';

interface PlRow {
  period: string;
  salesTotal: number;
  deliveryRevenue: number;
  goodsRevenue: number;
  goodsGrossProfit: number;
  warehouseRevenue?: number;
  warehouseGrossProfit?: number;
  warehouseNetProfitAllocated?: number;
  invoiceCount: number;
  operatingExpenses?: number;
  carExpenses?: number;
  salaryPaid?: number;
  salaryPaidDrivers?: number;
  salaryPaidManagers?: number;
  driverDeliverySalaryAccrued?: number;
  deliveryNetProfit?: number;
  cameIn?: number;
  wentOut?: number;
  remaining?: number;
  netProfit?: number;
}

interface PlSummary {
  totalSales: number;
  totalDeliveryRevenue: number;
  totalGoodsRevenue: number;
  totalGoodsGrossProfit: number;
  totalWarehouseRevenue?: number;
  totalWarehouseGrossProfit?: number;
  totalWarehouseNetProfitAllocated?: number;
  totalInvoices: number;
  totalOperatingExpenses?: number;
  totalNetProfit?: number;
  totalCarExpenses?: number;
  totalSalaryPaid?: number;
  totalSalaryPaidDrivers?: number;
  totalSalaryPaidManagers?: number;
  totalDriverDeliverySalaryAccrued?: number;
  totalDeliveryNetProfit?: number;
  totalCameIn?: number;
  totalWentOut?: number;
  totalRemaining?: number;
  expenseByCategory?: { category: string; total: number }[];
}

const from = ref('');
const to = ref('');
const groupBy = ref<'day' | 'month'>('day');

const rows = ref<PlRow[]>([]);
const summary = ref<PlSummary | null>(null);
const loading = ref(false);
const error = ref('');

interface OperatingExpenseDto {
  _id: string;
  date: string;
  amount: number;
  category: string;
  description?: string | null;
}

const expenses = ref<OperatingExpenseDto[]>([]);
const expensesLoading = ref(false);
const expensesError = ref('');

const newExpenseDate = ref('');
const newExpenseCategory = ref('other');
const newExpenseAmount = ref(0);
const newExpenseDescription = ref('');
const expenseSaving = ref(false);

// Средний чек по накладной
const avgCheck = computed(() => {
  const total = summary.value?.totalSales || 0;
  const count = summary.value?.totalInvoices || 0;
  if (!count || count <= 0) return 0;
  return total / count;
});

const formatMoney = (value: number) => {
  return (Number(value) || 0).toLocaleString('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const computeMargin = (row: PlRow) => {
  const rev = Number(row.goodsRevenue) || 0;
  const gp = Number(row.goodsGrossProfit) || 0;
  if (rev <= 0) return '-';
  const pct = (gp / rev) * 100;
  return pct.toFixed(1) + ' %';
};

// Общая маржа по товарам за выбранный период
const totalMargin = computed(() => {
  const rev = Number(summary.value?.totalGoodsRevenue || 0);
  const gp = Number(summary.value?.totalGoodsGrossProfit || 0);
  if (!rev || rev <= 0) return 0;
  return (gp / rev) * 100;
});

const loadData = async () => {
  loading.value = true;
  error.value = '';
  try {
    const params: any = { groupBy: groupBy.value };
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;

    const res = await axios.get('/api/v1/finance/pl', { params });
    rows.value = (res.data?.rows || []) as PlRow[];
    summary.value = (res.data?.summary || null) as PlSummary | null;
  } catch (e: any) {
    error.value = e?.response?.data?.message || 'Ошибка загрузки P&L отчёта';
  } finally {
    loading.value = false;
  }
};

const reloadAll = async () => {
  await Promise.all([loadData(), loadExpenses()]);
};

type Preset = 'today' | 'week' | 'month' | 'year' | 'prevYear';

const formatDateInput = (d: Date) => {
  return d.toISOString().slice(0, 10);
};

const setPreset = (p: Preset) => {
  const now = new Date();
  let start = new Date(now);
  let end = new Date(now);

  if (p === 'today') {
    // уже ок: start/end = сегодня
  } else if (p === 'week') {
    const day = now.getDay() || 7; // 1-7, где 1=вс?, но нам важен диапазон 7 дней
    start = new Date(now);
    start.setDate(now.getDate() - (day - 1));
  } else if (p === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (p === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
    end = new Date(now.getFullYear(), 11, 31);
  } else if (p === 'prevYear') {
    const y = now.getFullYear() - 1;
    start = new Date(y, 0, 1);
    end = new Date(y, 11, 31);
  }

  from.value = formatDateInput(start);
  to.value = formatDateInput(end);
  reloadAll();
};

const clearPreset = () => {
  from.value = '';
  to.value = '';
  reloadAll();
};

const onPrint = () => {
  window.print();
};

const loadExpenses = async () => {
  expensesLoading.value = true;
  expensesError.value = '';
  try {
    const params: any = {};
    if (from.value) params.from = from.value;
    if (to.value) params.to = to.value;
    const res = await axios.get('/api/v1/finance/operating-expenses', { params });
    expenses.value = (res.data?.expenses || []) as OperatingExpenseDto[];
  } catch (e: any) {
    expensesError.value = e?.response?.data?.message || 'Ошибка загрузки операционных расходов';
  } finally {
    expensesLoading.value = false;
  }
};

const canCreateExpense = computed(() => {
  return (
    !!newExpenseDate.value &&
    Number(newExpenseAmount.value) > 0 &&
    !!newExpenseCategory.value
  );
});

const createExpense = async () => {
  if (!canCreateExpense.value) return;

  expenseSaving.value = true;
  expensesError.value = '';
  try {
    const payload = {
      date: newExpenseDate.value,
      amount: Number(newExpenseAmount.value) || 0,
      category: newExpenseCategory.value,
      description: newExpenseDescription.value || undefined,
    };

    const res = await axios.post('/api/v1/finance/operating-expenses', payload);
    const exp = res.data?.expense as OperatingExpenseDto;
    if (exp && exp._id) {
      expenses.value.unshift(exp);
      // сброс формы
      newExpenseAmount.value = 0;
      newExpenseDescription.value = '';
      // перегружаем P&L, чтобы обновить чистую прибыль
      await loadData();
    }
  } catch (e: any) {
    expensesError.value = e?.response?.data?.message || 'Ошибка сохранения расхода';
  } finally {
    expenseSaving.value = false;
  }
};

const deleteExpense = async (exp: OperatingExpenseDto) => {
  if (!window.confirm('Удалить этот расход?')) return;

  try {
    await axios.delete(`/api/v1/finance/operating-expenses/${exp._id}`);
    expenses.value = expenses.value.filter((e) => e._id !== exp._id);
    await loadData();
  } catch (e: any) {
    expensesError.value = e?.response?.data?.message || 'Ошибка удаления расхода';
  }
};

const humanCategory = (code: string) => {
  switch (code) {
    case 'rent':
      return 'Аренда';
    case 'salary':
      return 'Зарплаты';
    case 'fuel':
      return 'Топливо';
    case 'carService':
      return 'Авто (ремонт/сервис)';
    case 'utilities':
      return 'Коммунальные / связь';
    case 'marketing':
      return 'Маркетинг';
    case 'taxes':
      return 'Налоги/взносы';
    default:
      return 'Другое';
  }
};

// начальная загрузка
reloadAll();
</script>

<style scoped>
@media print {
  .no-print {
    display: none !important;
  }
}
</style>
