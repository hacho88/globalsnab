import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { InvoiceModel } from '../models/Invoice';
import { OperatingExpenseModel } from '../models/OperatingExpense';
import { CarExpenseModel } from '../models/CarExpense';
import { SalaryPayoutModel } from '../models/SalaryPayout';

export const financeRouter = Router();

financeRouter.use(authMiddleware as any);

// Базовый P&L: продажи товаров/доставок и операционные расходы
financeRouter.get('/pl', async (req: AuthRequest, res) => {
  const { from, to, groupBy } = req.query as {
    from?: string;
    to?: string;
    groupBy?: 'day' | 'month';
  };

  const match: any = { isCancelled: { $ne: true } };

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const format = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

  const salesPipeline = [
    { $match: match },
    {
      $project: {
        date: 1,
        deliveryPrice: 1,
        totalAmount: 1,
        totalIncome: 1,
        period: { $dateToString: { format, date: '$date' } },
      },
    },
    {
      $group: {
        _id: '$period',
        salesTotal: { $sum: '$totalAmount' },
        deliveryRevenue: { $sum: '$deliveryPrice' },
        goodsRevenue: { $sum: { $subtract: ['$totalAmount', '$deliveryPrice'] } },
        goodsGrossProfit: { $sum: '$totalIncome' },
        invoiceCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        period: '$_id',
        salesTotal: 1,
        deliveryRevenue: 1,
        goodsRevenue: 1,
        goodsGrossProfit: 1,
        invoiceCount: 1,
      },
    },
    { $sort: { period: 1 } },
  ];

  const [
    salesRows,
    expenseRows,
    expenseByCategory,
    carExpenseRows,
    salaryPaidRows,
    driverDeliverySalaryRows,
    warehouseRows,
  ] = await Promise.all([
    (InvoiceModel as any).aggregate(salesPipeline),
    (OperatingExpenseModel as any).aggregate([
      {
        $match: {
          ...(from || to
            ? {
                date: {
                  ...(from ? { $gte: new Date(from) } : {}),
                  ...(to ? { $lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
      },
      {
        $project: {
          amount: 1,
          period: { $dateToString: { format, date: '$date' } },
        },
      },
      {
        $group: {
          _id: '$period',
          totalOperatingExpenses: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          totalOperatingExpenses: 1,
        },
      },
      { $sort: { period: 1 } },
    ]),
    (OperatingExpenseModel as any).aggregate([
      {
        $match: {
          ...(from || to
            ? {
                date: {
                  ...(from ? { $gte: new Date(from) } : {}),
                  ...(to ? { $lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
      },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          total: 1,
        },
      },
      { $sort: { total: -1 } },
    ]),
    (CarExpenseModel as any).aggregate([
      {
        $match: {
          ...(from || to
            ? {
                date: {
                  ...(from ? { $gte: new Date(from) } : {}),
                  ...(to ? { $lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
      },
      {
        $project: {
          amount: 1,
          period: { $dateToString: { format, date: '$date' } },
        },
      },
      {
        $group: {
          _id: '$period',
          totalCarExpenses: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          totalCarExpenses: 1,
        },
      },
      { $sort: { period: 1 } },
    ]),
    (SalaryPayoutModel as any).aggregate([
      {
        $match: {
          ...(from || to
            ? {
                paidAt: {
                  ...(from ? { $gte: new Date(from) } : {}),
                  ...(to ? { $lte: new Date(to) } : {}),
                },
              }
            : {}),
        },
      },
      {
        $project: {
          amount: 1,
          personType: 1,
          period: { $dateToString: { format, date: '$paidAt' } },
        },
      },
      {
        $group: {
          _id: { period: '$period', personType: '$personType' },
          totalSalaryPaid: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          personType: '$_id.personType',
          totalSalaryPaid: 1,
        },
      },
      { $sort: { period: 1 } },
    ]),
    (InvoiceModel as any).aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'cars',
          localField: 'car',
          foreignField: '_id',
          as: 'carDoc',
        },
      },
      { $unwind: { path: '$carDoc', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          deliveryPrice: 1,
          sharePercent: {
            $cond: [
              { $and: [{ $ne: ['$carDoc', null] }, { $isNumber: '$carDoc.driverSharePercent' }] },
              '$carDoc.driverSharePercent',
              0.5,
            ],
          },
          period: { $dateToString: { format, date: '$date' } },
        },
      },
      {
        $group: {
          _id: '$period',
          driverDeliverySalaryAccrued: { $sum: { $multiply: ['$deliveryPrice', '$sharePercent'] } },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          driverDeliverySalaryAccrued: 1,
        },
      },
      { $sort: { period: 1 } },
    ]),
    (InvoiceModel as any).aggregate([
      { $match: match },
      { $unwind: '$items' },
      { $match: { 'items.contractor': 'НАШ СКЛАД' } },
      {
        $project: {
          period: { $dateToString: { format, date: '$date' } },
          saleAmount: { $multiply: ['$items.salePrice', '$items.quantity'] },
          income: '$items.income',
        },
      },
      {
        $group: {
          _id: '$period',
          warehouseRevenue: { $sum: '$saleAmount' },
          warehouseGrossProfit: { $sum: '$income' },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          warehouseRevenue: 1,
          warehouseGrossProfit: 1,
        },
      },
      { $sort: { period: 1 } },
    ]),
  ]);

  const expenseMap = new Map<string, number>();
  for (const er of expenseRows as any[]) {
    expenseMap.set(er.period, Number(er.totalOperatingExpenses) || 0);
  }

  const carExpenseMap = new Map<string, number>();
  for (const cr of carExpenseRows as any[]) {
    carExpenseMap.set(cr.period, Number(cr.totalCarExpenses) || 0);
  }

  const salaryPaidMap = new Map<string, number>();
  const salaryPaidDriversMap = new Map<string, number>();
  const salaryPaidManagersMap = new Map<string, number>();
  for (const sr of salaryPaidRows as any[]) {
    const period = String(sr.period);
    const amt = Number(sr.totalSalaryPaid) || 0;
    salaryPaidMap.set(period, (salaryPaidMap.get(period) || 0) + amt);
    if (sr.personType === 'driver') {
      salaryPaidDriversMap.set(period, (salaryPaidDriversMap.get(period) || 0) + amt);
    } else if (sr.personType === 'manager') {
      salaryPaidManagersMap.set(period, (salaryPaidManagersMap.get(period) || 0) + amt);
    }
  }

  const driverDeliverySalaryMap = new Map<string, number>();
  for (const dr of driverDeliverySalaryRows as any[]) {
    driverDeliverySalaryMap.set(dr.period, Number(dr.driverDeliverySalaryAccrued) || 0);
  }

  const warehouseMap = new Map<string, { warehouseRevenue: number; warehouseGrossProfit: number }>();
  for (const wr of warehouseRows as any[]) {
    warehouseMap.set(String(wr.period), {
      warehouseRevenue: Number(wr.warehouseRevenue) || 0,
      warehouseGrossProfit: Number(wr.warehouseGrossProfit) || 0,
    });
  }

  const rows = (salesRows as any[]).map((r: any) => {
    const operatingExpenses = expenseMap.get(r.period) || 0;
    const carExpenses = carExpenseMap.get(r.period) || 0;
    const salaryPaid = salaryPaidMap.get(r.period) || 0;
    const salaryPaidDrivers = salaryPaidDriversMap.get(r.period) || 0;
    const salaryPaidManagers = salaryPaidManagersMap.get(r.period) || 0;

    const driverDeliverySalaryAccrued = driverDeliverySalaryMap.get(r.period) || 0;
    const deliveryNetProfit = (Number(r.deliveryRevenue) || 0) - driverDeliverySalaryAccrued;

    const wh = warehouseMap.get(r.period) || { warehouseRevenue: 0, warehouseGrossProfit: 0 };
    const goodsGrossProfit = Number(r.goodsGrossProfit) || 0;
    const whShare = goodsGrossProfit > 0 ? wh.warehouseGrossProfit / goodsGrossProfit : 0;
    const warehouseNetProfitAllocated = wh.warehouseGrossProfit - operatingExpenses * whShare;

    const cameIn = (Number(r.goodsGrossProfit) || 0) + deliveryNetProfit;
    const wentOut = operatingExpenses + carExpenses + salaryPaid;
    const remaining = cameIn - wentOut;

    const netProfit = (Number(r.goodsGrossProfit) || 0) - operatingExpenses;
    return {
      ...r,
      operatingExpenses,
      carExpenses,
      salaryPaid,
      salaryPaidDrivers,
      salaryPaidManagers,
      driverDeliverySalaryAccrued,
      deliveryNetProfit,
      warehouseRevenue: wh.warehouseRevenue,
      warehouseGrossProfit: wh.warehouseGrossProfit,
      warehouseNetProfitAllocated,
      cameIn,
      wentOut,
      remaining,
      netProfit,
    };
  });

  let totalSales = 0;
  let totalDeliveryRevenue = 0;
  let totalGoodsRevenue = 0;
  let totalGoodsGrossProfit = 0;
  let totalInvoices = 0;
  let totalOperatingExpenses = 0;
  let totalNetProfit = 0;
  let totalCarExpenses = 0;
  let totalSalaryPaid = 0;
  let totalSalaryPaidDrivers = 0;
  let totalSalaryPaidManagers = 0;
  let totalDriverDeliverySalaryAccrued = 0;
  let totalDeliveryNetProfit = 0;
  let totalCameIn = 0;
  let totalWentOut = 0;
  let totalRemaining = 0;
  let totalWarehouseRevenue = 0;
  let totalWarehouseGrossProfit = 0;
  let totalWarehouseNetProfitAllocated = 0;

  for (const r of rows as any[]) {
    totalSales += Number(r.salesTotal) || 0;
    totalDeliveryRevenue += Number(r.deliveryRevenue) || 0;
    totalGoodsRevenue += Number(r.goodsRevenue) || 0;
    totalGoodsGrossProfit += Number(r.goodsGrossProfit) || 0;
    totalInvoices += Number(r.invoiceCount) || 0;
    totalOperatingExpenses += Number(r.operatingExpenses) || 0;
    totalNetProfit += Number(r.netProfit) || 0;
    totalCarExpenses += Number(r.carExpenses) || 0;
    totalSalaryPaid += Number(r.salaryPaid) || 0;
    totalSalaryPaidDrivers += Number(r.salaryPaidDrivers) || 0;
    totalSalaryPaidManagers += Number(r.salaryPaidManagers) || 0;
    totalDriverDeliverySalaryAccrued += Number(r.driverDeliverySalaryAccrued) || 0;
    totalDeliveryNetProfit += Number(r.deliveryNetProfit) || 0;
    totalCameIn += Number(r.cameIn) || 0;
    totalWentOut += Number(r.wentOut) || 0;
    totalRemaining += Number(r.remaining) || 0;
    totalWarehouseRevenue += Number(r.warehouseRevenue) || 0;
    totalWarehouseGrossProfit += Number(r.warehouseGrossProfit) || 0;
    totalWarehouseNetProfitAllocated += Number(r.warehouseNetProfitAllocated) || 0;
  }

  return res.json({
    rows,
    summary: {
      totalSales,
      totalDeliveryRevenue,
      totalGoodsRevenue,
      totalGoodsGrossProfit,
      totalInvoices,
      totalOperatingExpenses,
      totalNetProfit,
      totalCarExpenses,
      totalSalaryPaid,
      totalSalaryPaidDrivers,
      totalSalaryPaidManagers,
      totalDriverDeliverySalaryAccrued,
      totalDeliveryNetProfit,
      totalCameIn,
      totalWentOut,
      totalRemaining,
      totalWarehouseRevenue,
      totalWarehouseGrossProfit,
      totalWarehouseNetProfitAllocated,
      expenseByCategory,
    },
  });
});

// Операционные расходы: список с фильтром по периоду
financeRouter.get('/operating-expenses', async (req: AuthRequest, res) => {
  const { from, to, category } = req.query as { from?: string; to?: string; category?: string };

  const filter: any = {};
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  if (category && category.trim()) {
    filter.category = category.trim();
  }

  const expenses = await OperatingExpenseModel.find(filter).sort({ date: -1, createdAt: -1 }).limit(1000);
  return res.json({ expenses });
});

// Создать операционный расход
financeRouter.post('/operating-expenses', async (req: AuthRequest, res) => {
  const body = req.body as any;

  const expense = await OperatingExpenseModel.create({
    date: body.date ? new Date(body.date) : new Date(),
    amount: Number(body.amount) || 0,
    category: String(body.category || 'other'),
    description: body.description || null,
    isFixed: !!body.isFixed,
  });

  return res.status(201).json({ expense });
});

// Обновить операционный расход
financeRouter.put('/operating-expenses/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const body = req.body as any;

  const expense = await OperatingExpenseModel.findByIdAndUpdate(
    id,
    {
      $set: {
        ...(body.date ? { date: new Date(body.date) } : {}),
        ...(body.amount != null ? { amount: Number(body.amount) || 0 } : {}),
        ...(body.category != null ? { category: String(body.category || 'other') } : {}),
        ...(body.description !== undefined ? { description: body.description || null } : {}),
        ...(typeof body.isFixed === 'boolean' ? { isFixed: body.isFixed } : {}),
      },
    },
    { new: true }
  );

  if (!expense) {
    return res.status(404).json({ message: 'Расход не найден' });
  }

  return res.json({ expense });
});

// Удалить операционный расход
financeRouter.delete('/operating-expenses/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const expense = await OperatingExpenseModel.findByIdAndDelete(id);
  if (!expense) {
    return res.status(404).json({ message: 'Расход не найден' });
  }

  return res.json({ success: true });
});

// Отчёт по операционным расходам: суммы по категориям
financeRouter.get('/operating-expenses/report', async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };

  const match: any = {};
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        total: 1,
        count: 1,
      },
    },
    { $sort: { total: -1 } },
  ];

  const rows = await (OperatingExpenseModel as any).aggregate(pipeline);

  let totalAmount = 0;
  let totalCount = 0;

  for (const r of rows as any[]) {
    totalAmount += Number(r.total) || 0;
    totalCount += Number(r.count) || 0;
  }

  return res.json({
    rows,
    summary: {
      totalAmount,
      totalCount,
    },
  });
});
