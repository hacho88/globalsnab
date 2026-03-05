<template>
  <div class="min-h-screen flex bg-slate-900 text-slate-100 relative">
    <CallOverlay />
    <div
      v-if="isMobileMenuOpen"
      class="fixed inset-0 bg-black/60 z-40 md:hidden"
      @click="isMobileMenuOpen = false"
    ></div>

    <aside
      class="bg-slate-950 border-r border-slate-800 flex flex-col z-50 md:z-auto md:static md:translate-x-0"
      :class="[
        'fixed inset-y-0 left-0 w-72 max-w-[85vw] transform transition-transform duration-200 ease-out',
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full',
        'md:w-64 md:transform-none',
      ]"
    >
      <div class="px-4 py-4 text-xl font-bold border-b border-slate-800">
        GlobalSnab
      </div>
      <nav class="flex-1 px-2 py-4 space-y-1 text-sm">
        <RouterLink
          to="/"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          🏠 Главная
        </RouterLink>
        <RouterLink
          to="/ai-assistant"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          Global AI
        </RouterLink>
        <RouterLink
          to="/invoices"
          v-if="canView('invoices')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          🧾 Накладные
        </RouterLink>
        <RouterLink
          to="/checks"
          v-if="canView('checks')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          🧾 Чеки
        </RouterLink>
        <RouterLink
          to="/warehouse"
          v-if="canView('warehouse')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          📦 Общая база товаров
        </RouterLink>
        <RouterLink
          to="/stock"
          v-if="canView('stock')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          🏪 Наш склад
        </RouterLink>
        <RouterLink
          to="/counterparties"
          v-if="canView('counterparties')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          🤝 Контрагенты
        </RouterLink>
        <RouterLink
          to="/clients"
          v-if="canView('clients')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          👥 Клиенты
        </RouterLink>
        <RouterLink
          to="/cars"
          v-if="canView('cars')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          🚗 Автопарк
        </RouterLink>
        <RouterLink
          to="/drivers"
          v-if="canView('drivers')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          👥 Водители
        </RouterLink>
        <RouterLink
          to="/reports/finance-pl"
          v-if="canView('reportsInvoices')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          💰 Финансы (P&L)
        </RouterLink>
        <RouterLink
          to="/reports/realtime"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          📡 Отчёты в реальном времени
        </RouterLink>
        <RouterLink
          to="/salaries"
          v-if="canView('salaries')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          💸 Зарплаты работникам
        </RouterLink>
        <RouterLink
          to="/admin/users"
          v-if="auth.user && auth.user.role === 'admin'"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          👤 Пользователи
        </RouterLink>
        <RouterLink
          to="/reports"
          v-if="canView('reports')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          📊 Отчеты
        </RouterLink>
        <RouterLink
          to="/reports/warehouse-profit"
          class="block px-3 py-2 rounded hover:bg-slate-800 pl-6 text-xs"
          active-class="bg-sky-600 text-white"
          v-if="canView('reportsWarehouseProfit')"
        >
          ▸ Прибыль Нашего склада
        </RouterLink>
        <RouterLink
          to="/reports/invoices"
          class="block px-3 py-2 rounded hover:bg-slate-800 pl-6 text-xs"
          active-class="bg-sky-600 text-white"
          v-if="canView('reportsInvoices')"
        >
          ▸ Отчёт по накладным
        </RouterLink>
        <RouterLink
          to="/reports/expenses"
          class="block px-3 py-2 rounded hover:bg-slate-800 pl-6 text-xs"
          active-class="bg-sky-600 text-white"
          v-if="canView('reportsInvoices')"
        >
          ▸ Отчёт по расходам
        </RouterLink>
        <RouterLink
          to="/reports/contractor-debts"
          class="block px-3 py-2 rounded hover:bg-slate-800 pl-6 text-xs"
          active-class="bg-sky-600 text-white"
          v-if="canView('reportsContractorDebts')"
        >
          ▸ Долги по контрагентам
        </RouterLink>
        <RouterLink
          to="/invoices/archive"
          v-if="canView('invoices')"
          class="block px-3 py-2 rounded hover:bg-slate-800"
          active-class="bg-sky-600 text-white"
        >
          📚 Архив накладных
        </RouterLink>

        <CallsSidebar />
      </nav>
      <div class="p-4 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
        <span>GlobalSnab ERP</span>
        <button
          class="text-slate-300 hover:text-white"
          @click="logout"
        >
          Выйти
        </button>
      </div>
    </aside>

    <main class="flex-1 flex flex-col">
      <header class="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="md:hidden inline-flex items-center justify-center h-9 w-9 rounded border border-slate-800 bg-slate-950 hover:bg-slate-900"
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            aria-label="Открыть меню"
          >
            ☰
          </button>
          <div class="font-semibold">Панель управления</div>
        </div>
        <div class="text-sm text-slate-300" v-if="auth.user">
          {{ auth.user.fullName }} ({{ auth.user.role }})
        </div>
      </header>

      <section class="flex-1 p-4">
        <router-view />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import CallsSidebar from '../components/CallsSidebar.vue';
import CallOverlay from '../components/CallOverlay.vue';
import { useAuthStore } from '../store/auth';

const auth = useAuthStore();
const isMobileMenuOpen = ref(false);
const route = useRoute();

watch(
  () => route.fullPath,
  () => {
    isMobileMenuOpen.value = false;
  }
);

onMounted(async () => {
  if (!auth.user && auth.accessToken) {
    try {
      await auth.fetchMe();
    } catch {
      // если не удалось восстановить пользователя, выходим из системы
      auth.logout();
    }
  }
});

const canView = (key: string): boolean => {
  const user = auth.user;
  if (!user) return false;
  // Админ всегда видит всё
  if (user.role === 'admin') return true;
  // Для совместимости: если permissions ещё не настроены - показываем всё
  if (!user.permissions) return true;
  return !!user.permissions[key];
};

const logout = () => {
  auth.logout();
  window.location.href = '/login';
};
</script>

<style scoped></style>
