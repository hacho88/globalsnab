import { Router } from 'express';
import { AuthRequest, authMiddleware } from '../middlewares/auth';
import { InvoiceModel } from '../models/Invoice';
import { SalaryPayoutModel } from '../models/SalaryPayout';
import { CarModel } from '../models/Car';
import { DriverModel } from '../models/Driver';
import { UserModel } from '../models/User';

export const salariesRouter = Router();

salariesRouter.use(authMiddleware);

const monthKeyToRange = (monthKey: string): { from: Date; to: Date } | null => {
  const m = /^\d{4}-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!m) return null;
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const from = new Date(year, month, 1, 0, 0, 0, 0);
  const to = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { from, to };
};

// Сводка зарплат за месяц (месяц начисления): кто сколько заработал и выдано ли
salariesRouter.get('/summary', async (req: AuthRequest, res) => {
  const { month } = req.query as { month?: string };
  if (!month) {
    return res.status(400).json({ message: 'month is required (YYYY-MM)' });
  }

  const range = monthKeyToRange(month);
  if (!range) {
    return res.status(400).json({ message: 'Invalid month format, expected YYYY-MM' });
  }

  const invoiceFilter: any = {
    isCancelled: { $ne: true },
    date: { $gte: range.from, $lte: range.to },
  };

  const [invoices, payouts] = await Promise.all([
    InvoiceModel.find(invoiceFilter).populate('driver').populate('car').populate('createdBy').sort({ date: 1 }),
    SalaryPayoutModel.find({ monthKey: month }),
  ]);

  // driver accruals
  const driverAcc = new Map<
    string,
    {
      personId: string;
      name: string;
      amountAccrued: number;
    }
  >();

  // manager accruals
  const managerAcc = new Map<
    string,
    {
      personId: string;
      name: string;
      amountAccrued: number;
    }
  >();

  for (const inv of invoices as any[]) {
    const deliveryPrice = Number(inv.deliveryPrice || 0) || 0;
    const car = inv.car || null;
    const driver = inv.driver || null;

    if (driver && deliveryPrice > 0) {
      const share = typeof car?.driverSharePercent === 'number' ? car.driverSharePercent : 0.5;
      const amount = deliveryPrice * share;
      const id = String(driver._id);
      const prev = driverAcc.get(id) || { personId: id, name: String(driver.fullName || ''), amountAccrued: 0 };
      prev.amountAccrued += amount;
      driverAcc.set(id, prev);
    }

    const manager = inv.createdBy || null;
    const totalIncome = Number(inv.totalIncome || 0) || 0;
    if (manager && manager.role === 'manager' && totalIncome !== 0) {
      const amount = totalIncome * 0.2;
      const id = String(manager._id);
      const prev = managerAcc.get(id) || {
        personId: id,
        name: String(manager.fullName || manager.email || ''),
        amountAccrued: 0,
      };
      prev.amountAccrued += amount;
      managerAcc.set(id, prev);
    }
  }

  const payoutIndex = new Map<string, any>();
  for (const p of payouts as any[]) {
    payoutIndex.set(`${p.personType}:${String(p.personId)}`, p);
  }

  const drivers = Array.from(driverAcc.values())
    .map((r) => {
      const payout = payoutIndex.get(`driver:${r.personId}`);
      return {
        personId: r.personId,
        name: r.name,
        amountAccrued: r.amountAccrued,
        isPaid: Boolean(payout),
        paidAt: payout ? payout.paidAt : null,
        paidAmount: payout ? payout.amount : null,
      };
    })
    .sort((a, b) => b.amountAccrued - a.amountAccrued);

  const managers = Array.from(managerAcc.values())
    .map((r) => {
      const payout = payoutIndex.get(`manager:${r.personId}`);
      return {
        personId: r.personId,
        name: r.name,
        amountAccrued: r.amountAccrued,
        isPaid: Boolean(payout),
        paidAt: payout ? payout.paidAt : null,
        paidAmount: payout ? payout.amount : null,
      };
    })
    .sort((a, b) => b.amountAccrued - a.amountAccrued);

  return res.json({ monthKey: month, from: range.from, to: range.to, drivers, managers });
});

// Отметить выплату "выдано" за месяц
salariesRouter.post('/payout', async (req: AuthRequest, res) => {
  const { monthKey, personType, personId, amount, paidAt } = req.body as {
    monthKey?: string;
    personType?: 'driver' | 'manager';
    personId?: string;
    amount?: number;
    paidAt?: string;
  };

  if (!monthKey || !personType || !personId) {
    return res.status(400).json({ message: 'monthKey, personType, personId are required' });
  }
  const range = monthKeyToRange(monthKey);
  if (!range) {
    return res.status(400).json({ message: 'Invalid monthKey format, expected YYYY-MM' });
  }

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt < 0) {
    return res.status(400).json({ message: 'amount must be a non-negative number' });
  }

  const paidDate = paidAt ? new Date(paidAt) : new Date();
  if (Number.isNaN(paidDate.getTime())) {
    return res.status(400).json({ message: 'Invalid paidAt' });
  }

  const doc = await SalaryPayoutModel.findOneAndUpdate(
    { monthKey, personType, personId },
    {
      $set: {
        monthKey,
        personType,
        personId,
        amount: amt,
        paidAt: paidDate,
        createdBy: req.user!.id,
      },
    },
    { upsert: true, new: true }
  );

  return res.json({ payout: doc });
});

// Отменить отметку "выдано" (если ошиблись)
salariesRouter.delete('/payout', async (req: AuthRequest, res) => {
  const { monthKey, personType, personId } = req.query as {
    monthKey?: string;
    personType?: 'driver' | 'manager';
    personId?: string;
  };

  if (!monthKey || !personType || !personId) {
    return res.status(400).json({ message: 'monthKey, personType, personId are required' });
  }

  await SalaryPayoutModel.deleteOne({ monthKey, personType, personId });
  return res.json({ ok: true });
});
