import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { ClientModel } from '../models/Client';
import { InvoiceModel } from '../models/Invoice';

export const clientsRouter = Router();

clientsRouter.use(authMiddleware as any);

// Получить список клиентов с поиском
clientsRouter.get('/', async (req: AuthRequest, res) => {
  const { q } = req.query as { q?: string };

  const filter: any = {};
  if (q && q.trim()) {
    const regex = new RegExp(q.trim(), 'i');
    filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
  }

  const clients = await ClientModel.find(filter).sort({ name: 1 }).limit(500);
  return res.json({ clients });
});

// Создать клиента
clientsRouter.post('/', async (req: AuthRequest, res) => {
  const body = req.body as any;

  const client = await ClientModel.create({
    name: String(body.name || '').trim(),
    phone: body.phone || null,
    email: body.email || null,
    city: body.city || null,
    address: body.address || null,
    notes: body.notes || null,
    isActive: typeof body.isActive === 'boolean' ? body.isActive : true,
  });

  return res.status(201).json({ client });
});

// Обновить клиента
clientsRouter.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const body = req.body as any;

  const client = await ClientModel.findByIdAndUpdate(
    id,
    {
      $set: {
        name: String(body.name || '').trim(),
        phone: body.phone || null,
        email: body.email || null,
        city: body.city || null,
        address: body.address || null,
        notes: body.notes || null,
        ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      },
    },
    { new: true }
  );

  if (!client) {
    return res.status(404).json({ message: 'Клиент не найден' });
  }

  return res.json({ client });
});

// Получить одного клиента
clientsRouter.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const client = await ClientModel.findById(id);
  if (!client) {
    return res.status(404).json({ message: 'Клиент не найден' });
  }
  return res.json({ client });
});

// Отчёт по клиенту: суммы продаж и список накладных
clientsRouter.get('/:id/report', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const client = await ClientModel.findById(id);
  if (!client) {
    return res.status(404).json({ message: 'Клиент не найден' });
  }

  const invoices = await InvoiceModel.find({
    clientRef: client._id,
    isCancelled: { $ne: true },
  })
    .sort({ date: -1 })
    .select({
      number: 1,
      date: 1,
      client: 1,
      totalAmount: 1,
      totalIncome: 1,
    })
    .lean();

  let totalSales = 0;
  let totalIncome = 0;

  for (const inv of invoices as any[]) {
    totalSales += Number(inv.totalAmount) || 0;
    totalIncome += Number(inv.totalIncome) || 0;
  }

  return res.json({
    client,
    summary: {
      totalSales,
      totalIncome,
      invoicesCount: invoices.length,
    },
    invoices,
  });
});

// ТОП клиентов по выручке/доходу за период
clientsRouter.get('/top/list', async (req: AuthRequest, res) => {
  const { from, to, limit } = req.query as { from?: string; to?: string; limit?: string };

  const match: any = { isCancelled: { $ne: true } };

  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to) match.date.$lte = new Date(to);
  }

  match.clientRef = { $ne: null };

  const topLimit = Math.min(Math.max(parseInt(limit || '20', 10) || 20, 1), 100);

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$clientRef',
        totalSales: { $sum: '$totalAmount' },
        totalIncome: { $sum: '$totalIncome' },
        invoicesCount: { $sum: 1 },
      },
    },
    { $sort: { totalSales: -1 } },
    { $limit: topLimit },
    {
      $lookup: {
        from: 'clients',
        localField: '_id',
        foreignField: '_id',
        as: 'client',
      },
    },
    {
      $unwind: {
        path: '$client',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        clientId: '$_id',
        clientName: '$client.name',
        clientPhone: '$client.phone',
        clientEmail: '$client.email',
        totalSales: 1,
        totalIncome: 1,
        invoicesCount: 1,
      },
    },
  ];

  const rows = await (InvoiceModel as any).aggregate(pipeline);

  let summaryTotalSales = 0;
  let summaryTotalIncome = 0;
  let summaryInvoicesCount = 0;

  for (const r of rows as any[]) {
    summaryTotalSales += Number(r.totalSales) || 0;
    summaryTotalIncome += Number(r.totalIncome) || 0;
    summaryInvoicesCount += Number(r.invoicesCount) || 0;
  }

  return res.json({
    rows,
    summary: {
      totalSales: summaryTotalSales,
      totalIncome: summaryTotalIncome,
      invoicesCount: summaryInvoicesCount,
    },
  });
});

// (Опционально) деактивировать клиента
clientsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const client = await ClientModel.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { new: true }
  );
  if (!client) {
    return res.status(404).json({ message: 'Клиент не найден' });
  }
  return res.json({ client });
});
