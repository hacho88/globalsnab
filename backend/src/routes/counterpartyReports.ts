import { Router } from 'express';
import { CounterpartyModel } from '../models/Counterparty';
import { InvoiceModel } from '../models/Invoice';
import { authMiddleware, AuthRequest } from '../middlewares/auth';

export const counterpartyReportsRouter = Router();

counterpartyReportsRouter.use(authMiddleware);

// Отчёт по контрагенту по накладным: группировка по накладной и суммирование по строкам контрагента
counterpartyReportsRouter.get('/:id/invoices', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { from, to, onlyUnpaid } = req.query as { from?: string; to?: string; onlyUnpaid?: string };

  const counterparty = await CounterpartyModel.findById(id);
  if (!counterparty) {
    return res.status(404).json({ message: 'Контрагент не найден' });
  }

  const contractorName = counterparty.name;
  const escapedName = contractorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contractorRegex = new RegExp(`^${escapedName}$`, 'i');

  const match: any = {
    isCancelled: { $ne: true },
  };

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      match.date.$lt = end;
    }
  }

  const unpaidOnly = String(onlyUnpaid || '').toLowerCase() === 'true';

  const pipeline: any[] = [
    { $match: match },
    { $unwind: '$items' },
    {
      $match: {
        'items.contractor': { $regex: contractorRegex },
        ...(unpaidOnly ? { 'items.paidToContractor': { $ne: true } } : {}),
      },
    },
    {
      $group: {
        _id: '$_id',
        number: { $first: '$number' },
        date: { $first: '$date' },
        paymentType: { $first: '$paymentType' },
        itemsCount: { $sum: 1 },
        totalQty: { $sum: '$items.quantity' },
        totalSale: { $sum: { $multiply: ['$items.quantity', '$items.salePrice'] } },
        totalIncome: { $sum: '$items.income' },
        totalPurchaseCash: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentType', 'cash'] },
                  { $ifNull: ['$items.purchasePriceCash', false] },
                  { $ifNull: ['$items.quantity', false] },
                ],
              },
              { $multiply: ['$items.quantity', '$items.purchasePriceCash'] },
              0,
            ],
          },
        },
        totalPurchaseCashless: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentType', 'cashless'] },
                  { $ifNull: ['$items.purchasePriceCashless', false] },
                  { $ifNull: ['$items.quantity', false] },
                ],
              },
              { $multiply: ['$items.quantity', '$items.purchasePriceCashless'] },
              0,
            ],
          },
        },
        itemIds: { $push: '$items._id' },
      },
    },
    {
      $project: {
        _id: 0,
        invoiceId: { $toString: '$_id' },
        number: 1,
        date: 1,
        paymentType: 1,
        itemsCount: 1,
        totalQty: 1,
        totalPurchaseCash: 1,
        totalPurchaseCashless: 1,
        totalSale: 1,
        totalIncome: 1,
        itemIds: 1,
      },
    },
    { $sort: { date: 1, number: 1 } },
  ];

  const invoices = await (InvoiceModel as any).aggregate(pipeline);

  const summary = invoices.reduce(
    (
      acc: {
        invoicesCount: number;
        itemsCount: number;
        totalQty: number;
        totalPurchaseCash: number;
        totalPurchaseCashless: number;
        totalSale: number;
        totalIncome: number;
      },
      r: any,
    ) => {
      acc.invoicesCount += 1;
      acc.itemsCount += Number(r.itemsCount) || 0;
      acc.totalQty += Number(r.totalQty) || 0;
      acc.totalPurchaseCash += Number(r.totalPurchaseCash) || 0;
      acc.totalPurchaseCashless += Number(r.totalPurchaseCashless) || 0;
      acc.totalSale += Number(r.totalSale) || 0;
      acc.totalIncome += Number(r.totalIncome) || 0;
      return acc;
    },
    {
      invoicesCount: 0,
      itemsCount: 0,
      totalQty: 0,
      totalPurchaseCash: 0,
      totalPurchaseCashless: 0,
      totalSale: 0,
      totalIncome: 0,
    },
  );

  return res.json({
    counterparty: { id: counterparty._id.toString(), name: counterparty.name },
    summary,
    invoices,
  });
});

// Отчёт по одному контрагенту: продажи, закупка, прибыль, детализация по товарам
counterpartyReportsRouter.get('/:id/report', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { from, to } = req.query as { from?: string; to?: string };

  const counterparty = await CounterpartyModel.findById(id);
  if (!counterparty) {
    return res.status(404).json({ message: 'Контрагент не найден' });
  }

  const contractorName = counterparty.name;
  // Экранируем спецсимволы в имени, чтобы безопасно собрать RegExp
  const escapedName = contractorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const contractorRegex = new RegExp(`^${escapedName}$`, 'i');

  const match: any = {
    isCancelled: { $ne: true },
    'items.contractor': { $regex: contractorRegex },
  };

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      match.date.$lt = end;
    }
  }

  // Агрегация по всем строкам товаров этого контрагента
  const pipeline = [
    { $match: match },
    { $unwind: '$items' },
    { $match: { 'items.contractor': { $regex: contractorRegex } } },
    {
      $group: {
        _id: null,
        totalPurchaseCash: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentType', 'cash'] },
                  { $ifNull: ['$items.purchasePriceCash', false] },
                  { $ifNull: ['$items.quantity', false] },
                ],
              },
              { $multiply: ['$items.quantity', '$items.purchasePriceCash'] },
              0,
            ],
          },
        },
        totalPurchaseCashless: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentType', 'cashless'] },
                  { $ifNull: ['$items.purchasePriceCashless', false] },
                  { $ifNull: ['$items.quantity', false] },
                ],
              },
              { $multiply: ['$items.quantity', '$items.purchasePriceCashless'] },
              0,
            ],
          },
        },
        totalSale: { $sum: { $multiply: ['$items.quantity', '$items.salePrice'] } },
        totalIncome: { $sum: '$items.income' },
      },
    },
  ];

  const summaryAgg = await (InvoiceModel as any).aggregate(pipeline);

  const summary = {
    totalPurchaseCash: 0,
    totalPurchaseCashless: 0,
    totalSale: 0,
    totalIncome: 0,
  };

  if (summaryAgg.length > 0) {
    summary.totalPurchaseCash = Number(summaryAgg[0].totalPurchaseCash) || 0;
    summary.totalPurchaseCashless = Number(summaryAgg[0].totalPurchaseCashless) || 0;
    summary.totalSale = Number(summaryAgg[0].totalSale) || 0;
    summary.totalIncome = Number(summaryAgg[0].totalIncome) || 0;
  }

  // Детализация по товарам
  const detailsPipeline = [
    { $match: match },
    { $unwind: '$items' },
    { $match: { 'items.contractor': { $regex: contractorRegex } } },
    {
      $group: {
        _id: {
          name: '$items.name',
          unit: '$items.unit',
        },
        totalQty: { $sum: '$items.quantity' },
        totalPurchaseCash: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentType', 'cash'] },
                  { $ifNull: ['$items.purchasePriceCash', false] },
                  { $ifNull: ['$items.quantity', false] },
                ],
              },
              { $multiply: ['$items.quantity', '$items.purchasePriceCash'] },
              0,
            ],
          },
        },
        totalPurchaseCashless: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$paymentType', 'cashless'] },
                  { $ifNull: ['$items.purchasePriceCashless', false] },
                  { $ifNull: ['$items.quantity', false] },
                ],
              },
              { $multiply: ['$items.quantity', '$items.purchasePriceCashless'] },
              0,
            ],
          },
        },
        totalSale: { $sum: { $multiply: ['$items.quantity', '$items.salePrice'] } },
        totalIncome: { $sum: '$items.income' },
      },
    },
    {
      $project: {
        _id: 0,
        name: '$_id.name',
        unit: '$_id.unit',
        totalQty: 1,
        totalPurchaseCash: 1,
        totalPurchaseCashless: 1,
        totalSale: 1,
        totalIncome: 1,
      },
    },
    { $sort: { name: 1 } },
  ];

  const items = await (InvoiceModel as any).aggregate(detailsPipeline);

  return res.json({
    counterparty: { id: counterparty._id.toString(), name: counterparty.name },
    summary,
    items,
  });
});
