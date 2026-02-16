import { Router } from 'express';
import { AuthRequest, authMiddleware } from '../middlewares/auth';
import { InvoiceModel } from '../models/Invoice';
import { DriverModel } from '../models/Driver';
import { CarModel } from '../models/Car';
import { UserModel } from '../models/User';
import { OperatingExpenseModel } from '../models/OperatingExpense';

export const reportsRouter = Router();

reportsRouter.use(authMiddleware);

// Прибыль НАШЕГО СКЛАДА по дням/неделям/месяцам/годам
reportsRouter.get('/warehouse-profit', async (req: AuthRequest, res) => {
  const { from, to, groupBy } = req.query as { from?: string; to?: string; groupBy?: string };

  const match: any = { isCancelled: { $ne: true } };
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  const gb = groupBy === 'week' || groupBy === 'month' || groupBy === 'year' ? groupBy : 'day';

  const groupId: any = {};
  if (gb === 'day') {
    groupId.year = { $year: '$date' };
    groupId.month = { $month: '$date' };
    groupId.day = { $dayOfMonth: '$date' };
  } else if (gb === 'week') {
    groupId.year = { $isoWeekYear: '$date' };
    groupId.week = { $isoWeek: '$date' };
  } else if (gb === 'month') {
    groupId.year = { $year: '$date' };
    groupId.month = { $month: '$date' };
  } else if (gb === 'year') {
    groupId.year = { $year: '$date' };
  }

  const pipeline = [
    { $match: match },
    { $unwind: '$items' },
    { $match: { 'items.contractor': 'НАШ СКЛАД' } },
    {
      $group: {
        _id: groupId,
        totalIncome: { $sum: '$items.income' },
        totalAmount: { $sum: { $multiply: ['$items.salePrice', '$items.quantity'] } },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
  ];

  const rows = await InvoiceModel.aggregate(pipeline as any[]);

  return res.json({ groupBy: gb, rows });
});

// Зарплаты водителей по накладным за период
reportsRouter.get('/driver-salaries', async (req: AuthRequest, res) => {
  const { from, to, driverId } = req.query as { from?: string; to?: string; driverId?: string };

  const filter: any = { isCancelled: { $ne: true } };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (driverId) {
    filter.driver = driverId;
  }

  const invoices = await InvoiceModel.find(filter).populate('driver').populate('car').sort({ date: 1 });

  const rows = invoices.map((inv) => {
    const deliveryPrice = Number((inv as any).deliveryPrice || 0) || 0;
    const car: any = (inv as any).car || null;
    const driver: any = (inv as any).driver || null;
    const share = typeof car?.driverSharePercent === 'number' ? car.driverSharePercent : 0.5;
    const driverSalary = deliveryPrice * share;

    return {
      invoiceId: String(inv._id),
      date: inv.date,
      number: inv.number,
      driverId: driver ? String(driver._id) : null,
      driverName: driver?.fullName || null,
      carId: car ? String(car._id) : null,
      carName: car?.name || null,
      deliveryPrice,
      sharePercent: share,
      driverSalary,
    };
  });

  const summary = rows.reduce(
    (acc, r) => {
      acc.totalDelivery += r.deliveryPrice;
      acc.totalSalary += r.driverSalary;
      return acc;
    },
    { totalDelivery: 0, totalSalary: 0 },
  );

  return res.json({ rows, summary });
});

// Доходы в реальном времени по продажам и доставке за выбранный период
reportsRouter.get('/realtime-income', async (req: AuthRequest, res) => {
  try {
    const { period } = req.query as { period?: string };

    const now = new Date();
    let from: Date;
    let to: Date;
    const p = (period || 'day').toLowerCase();

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    if (p === 'week') {
      const tmp = new Date(now);
      const day = tmp.getDay() || 7; // 1..7, где 1 = понедельник
      if (day > 1) {
        tmp.setDate(tmp.getDate() - (day - 1));
      }
      from = startOfDay(tmp);
      to = endOfDay(now);
    } else if (p === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
    } else if (p === 'year') {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
    } else {
      from = startOfDay(now);
      to = endOfDay(now);
    }

    const match: any = {
      isCancelled: { $ne: true },
      date: { $gte: from, $lte: to },
    };

    const rows = await InvoiceModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: '$totalAmount' },
          totalDelivery: { $sum: '$deliveryPrice' },
          totalIncome: { $sum: '$totalIncome' },
        },
      },
    ] as any[]);

    const row = rows[0] || { totalSales: 0, totalDelivery: 0, totalIncome: 0 };

    return res.json({
      period: p,
      from,
      to,
      totals: {
        sales: row.totalSales || 0,
        delivery: row.totalDelivery || 0,
        income: row.totalIncome || 0,
      },
    });
  } catch (e: any) {
    console.error('[reports] realtime-income error:', e);
    return res.status(500).json({ message: 'Ошибка отчёта доходов в реальном времени' });
  }
});

// Расходы в реальном времени за выбранный период
reportsRouter.get('/realtime-expenses', async (req: AuthRequest, res) => {
  try {
    const { period } = req.query as { period?: string };

    const now = new Date();
    let from: Date;
    let to: Date;
    const p = (period || 'day').toLowerCase();

    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    if (p === 'week') {
      const tmp = new Date(now);
      const day = tmp.getDay() || 7;
      if (day > 1) {
        tmp.setDate(tmp.getDate() - (day - 1));
      }
      from = startOfDay(tmp);
      to = endOfDay(now);
    } else if (p === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      to = endOfDay(now);
    } else if (p === 'year') {
      from = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      to = endOfDay(now);
    } else {
      from = startOfDay(now);
      to = endOfDay(now);
    }

    const [operating, driverAgg, managerInvoices] = await Promise.all([
      OperatingExpenseModel.aggregate([
        {
          $match: {
            date: { $gte: from, $lte: to },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
          },
        },
      ] as any[]),
      InvoiceModel.aggregate([
        {
          $match: {
            isCancelled: { $ne: true },
            date: { $gte: from, $lte: to },
          },
        },
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
          $group: {
            _id: null,
            totalDelivery: { $sum: '$deliveryPrice' },
            totalDriverSalary: {
              $sum: {
                $multiply: [
                  '$deliveryPrice',
                  {
                    $cond: [
                      { $and: [{ $ne: ['$carDoc', null] }, { $isNumber: '$carDoc.driverSharePercent' }] },
                      '$carDoc.driverSharePercent',
                      0.5,
                    ],
                  },
                ],
              },
            },
          },
        },
      ] as any[]),
      InvoiceModel.find({
        isCancelled: { $ne: true },
        date: { $gte: from, $lte: to },
      })
        .populate('createdBy')
        .sort({ date: 1 }),
    ]);

    const operatingTotal = (operating[0]?.total as number) || 0;
    const driverTotal = (driverAgg[0]?.totalDriverSalary as number) || 0;

    // Для менеджеров учитываем только накладные, созданные пользователями с ролью 'manager'
    let managerBaseIncome = 0;
    for (const inv of managerInvoices as any[]) {
      const creator: any = (inv as any).createdBy || null;
      if (!creator || creator.role !== 'manager') continue;
      managerBaseIncome += Number((inv as any).totalIncome || 0) || 0;
    }

    const managerTotal = managerBaseIncome * 0.2;

    return res.json({
      period: p,
      from,
      to,
      totals: {
        operational: operatingTotal,
        drivers: driverTotal,
        managers: managerTotal,
        total: operatingTotal + driverTotal + managerTotal,
      },
    });
  } catch (e: any) {
    console.error('[reports] realtime-expenses error:', e);
    return res.status(500).json({ message: 'Ошибка отчёта расходов в реальном времени' });
  }
});

// Зарплаты менеджеров: 20% от чистой прибыли (totalIncome) по накладным за период
reportsRouter.get('/manager-salaries', async (req: AuthRequest, res) => {
  const { from, to, userId } = req.query as { from?: string; to?: string; userId?: string };

  const filter: any = { isCancelled: { $ne: true } };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (userId) {
    filter.createdBy = userId;
  }

  const invoices = await InvoiceModel.find(filter).populate('createdBy').sort({ date: 1 });

  const rows = invoices
    .map((inv) => {
      const totalIncome = Number((inv as any).totalIncome || 0) || 0;
      const manager: any = (inv as any).createdBy || null;

      // Зарплата только для пользователей с ролью 'manager'
      if (!manager || manager.role !== 'manager') {
        return null;
      }

      const managerSalary = totalIncome * 0.2;

      return {
        invoiceId: String(inv._id),
        date: inv.date,
        number: inv.number,
        managerId: String(manager._id),
        managerName: manager.fullName || manager.email || null,
        totalIncome,
        salaryPercent: 0.2,
        managerSalary,
      };
    })
    .filter((r) => r !== null) as Array<{
      invoiceId: string;
      date: Date;
      number: string;
      managerId: string | null;
      managerName: string | null;
      totalIncome: number;
      salaryPercent: number;
      managerSalary: number;
    }>;

  const summary = rows.reduce(
    (acc, r) => {
      acc.totalIncome += r.totalIncome;
      acc.totalSalary += r.managerSalary;
      return acc;
    },
    { totalIncome: 0, totalSalary: 0 },
  );

  return res.json({ rows, summary });
});
