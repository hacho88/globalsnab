import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../store/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('../views/dashboard/DashboardView.vue'),
      },
      {
        path: 'invoices',
        name: 'invoices',
        component: () => import('../views/invoices/InvoicesView.vue'),
      },
      {
        path: 'invoices/:id/print',
        name: 'invoicePrint',
        component: () => import('../views/invoices/InvoicePrintView.vue'),
      },
      {
        path: 'invoices/:id/bill',
        name: 'invoiceBill',
        component: () => import('../views/invoices/InvoiceBillView.vue'),
      },
      {
        path: 'invoices/archive',
        name: 'invoicesArchive',
        component: () => import('../views/invoices/InvoicesArchiveView.vue'),
      },
      {
        path: 'warehouse',
        name: 'productsBase',
        component: () => import('../views/warehouse/WarehouseView.vue'),
      },
      {
        path: 'stock',
        name: 'stock',
        component: () => import('../views/stock/StockView.vue'),
      },
      {
        path: 'counterparties',
        name: 'counterparties',
        component: () => import('../views/counterparties/CounterpartiesView.vue'),
      },
      {
        path: 'counterparties/:id/print',
        name: 'counterpartyPrint',
        component: () => import('../views/counterparties/CounterpartyPrintView.vue'),
      },
      {
        path: 'cars',
        name: 'cars',
        component: () => import('../views/cars/CarsView.vue'),
      },
      {
        path: 'reports/warehouse-profit',
        name: 'warehouseProfit',
        component: () => import('../views/reports/WarehouseProfitView.vue'),
      },
      {
        path: 'reports',
        name: 'reportsRoot',
        redirect: { name: 'financePlReport' },
      },
      {
        path: 'reports/invoices',
        name: 'invoicesReport',
        component: () => import('../views/reports/InvoicesReportView.vue'),
      },
      {
        path: 'reports/finance-pl',
        name: 'financePlReport',
        component: () => import('../views/reports/FinancePLView.vue'),
      },
      {
        path: 'reports/expenses',
        name: 'expensesReport',
        component: () => import('../views/reports/ExpensesReportView.vue'),
      },
      {
        path: 'reports/contractor-debts',
        name: 'contractorDebts',
        component: () => import('../views/reports/ContractorDebtsView.vue'),
      },
      {
        path: 'reports/realtime',
        name: 'realtimeReports',
        component: () => import('../views/reports/RealtimeReportsView.vue'),
      },
      {
        path: 'admin/users',
        name: 'adminUsers',
        component: () => import('../views/admin/UsersView.vue'),
      },
      {
        path: 'salaries',
        name: 'salaries',
        component: () => import('../views/salaries/SalariesView.vue'),
      },
      {
        path: 'drivers',
        name: 'drivers',
        component: () => import('../views/drivers/DriversView.vue'),
      },
      {
        path: 'checks/:id/print',
        name: 'checkPrint',
        component: () => import('../views/checks/CheckPrintView.vue'),
      },
      {
        path: 'checks',
        name: 'checks',
        component: () => import('../views/checks/ChecksView.vue'),
      },
      {
        path: 'clients',
        name: 'clients',
        component: () => import('../views/clients/ClientsView.vue'),
      },
      {
        path: 'ai-assistant',
        name: 'aiAssistant',
        component: () => import('../views/ai/AiAssistantView.vue'),
      },
      {
        path: 'messages',
        name: 'messages',
        component: () => import('../views/messages/MessagesView.vue'),
      },
      {
        path: 'calls',
        name: 'calls',
        component: () => import('../views/calls/CallsView.vue'),
      },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

const routePermissionMap: Record<string, string> = {
  invoices: 'invoices',
  invoicesArchive: 'invoices',
  invoicePrint: 'invoices',
  invoiceBill: 'invoices',
  productsBase: 'warehouse',
  stock: 'stock',
  counterparties: 'counterparties',
  counterpartyPrint: 'counterparties',
  cars: 'cars',
  salaries: 'salaries',
  checks: 'checks',
  clients: 'clients',
  aiAssistant: 'aiAssistant',
  warehouseProfit: 'reportsWarehouseProfit',
  invoicesReport: 'reportsInvoices',
  financePlReport: 'reportsInvoices',
  expensesReport: 'reportsInvoices',
  contractorDebts: 'reportsContractorDebts',
  adminUsers: 'adminUsers',
};

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore();

  if (!to.meta.public && !auth.isAuthenticated) {
    return next({ name: 'login' });
  }
  if (to.name === 'login' && auth.isAuthenticated) {
    return next({ name: 'dashboard' });
  }

  const user = auth.user;
  // Для публичных маршрутов дальше не проверяем
  if (to.meta.public || !user) {
    return next();
  }

  // Админ всегда имеет доступ
  if (user.role === 'admin') {
    return next();
  }

  // Если permissions ещё не настроены — пропускаем всё (совместимость)
  if (!user.permissions) {
    return next();
  }

  const name = (to.name as string) || '';
  const permKey = routePermissionMap[name];

  // Если для маршрута не задан ключ прав — пропускаем
  if (!permKey) {
    return next();
  }

  if (user.permissions[permKey]) {
    return next();
  }

  // Нет прав на маршрут — отправляем на главную
  return next({ name: 'dashboard' });
});
