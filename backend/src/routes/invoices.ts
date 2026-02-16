import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { InvoiceModel } from '../models/Invoice';
import { WarehouseItemModel } from '../models/WarehouseItem';
import { ProductModel } from '../models/Product';
import { DriverModel } from '../models/Driver';
import { ClientModel } from '../models/Client';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import PDFDocument from 'pdfkit';

export const invoicesRouter = Router();

invoicesRouter.use(authMiddleware);

const invoiceUploadsDir = path.join(__dirname, '..', '..', 'uploads', 'invoice-attachments');
if (!fs.existsSync(invoiceUploadsDir)) {
  fs.mkdirSync(invoiceUploadsDir, { recursive: true });
}

const invoiceAttachmentsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, invoiceUploadsDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const invoiceAttachmentsUpload = multer({
  storage: invoiceAttachmentsStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'image/heic' ||
      file.mimetype === 'image/heif';
    if (!ok) {
      return cb(new Error('Недопустимый тип файла. Разрешены изображения и PDF.'));
    }
    cb(null, true);
  },
});

// Сводка долгов по контрагентам: суммы по строкам, где paidToContractor = false
invoicesRouter.get('/contractors/debts', async (req: AuthRequest, res) => {
  const pipeline = [
    { $unwind: '$items' },
    { $match: { 'items.paidToContractor': { $ne: true }, 'items.contractor': { $ne: 'НАШ СКЛАД' } } },
    {
      $group: {
        _id: '$items.contractor',
        totalDebt: { $sum: { $multiply: ['$items.quantity', '$items.salePrice'] } },
        invoiceCount: { $addToSet: '$_id' },
        itemsCount: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        contractor: '$_id',
        totalDebt: 1,
        itemsCount: 1,
        invoicesCount: { $size: '$invoiceCount' },
      },
    },
    { $sort: { contractor: 1 } },
  ];

  const rows = await (InvoiceModel as any).aggregate(pipeline);
  return res.json({ rows });
});

// Детализация долгов по одному контрагенту: список неоплаченных строк
invoicesRouter.get('/contractors/:name/debts', async (req: AuthRequest, res) => {
  const { name } = req.params;

  const pipeline = [
    { $unwind: '$items' },
    {
      $match: {
        'items.paidToContractor': { $ne: true },
        'items.contractor': name,
      },
    },
    {
      $project: {
        _id: 0,
        itemId: '$items._id',
        invoiceId: '$_id',
        number: '$number',
        date: '$date',
        name: '$items.name',
        quantity: '$items.quantity',
        unit: '$items.unit',
        salePrice: '$items.salePrice',
        amount: { $multiply: ['$items.quantity', '$items.salePrice'] },
      },
    },
    { $sort: { date: 1, number: 1 } },
  ];

  const items = await (InvoiceModel as any).aggregate(pipeline);
  return res.json({ items });
});

// Отметить строки накладных как оплаченные контрагенту
invoicesRouter.post('/contractors/mark-paid', async (req: AuthRequest, res) => {
  const { itemIds } = req.body as { itemIds?: string[] };

  if (!Array.isArray(itemIds) || itemIds.length === 0) {
    return res.status(400).json({ message: 'itemIds is required' });
  }

  const objectIds = itemIds
    .map((id) => {
      try {
        return new (require('mongoose').Types.ObjectId)(id);
      } catch {
        return null;
      }
    })
    .filter((id: any) => id);

  if (!objectIds.length) {
    return res.status(400).json({ message: 'Нет корректных идентификаторов строк' });
  }

  const result = await InvoiceModel.updateMany(
    { 'items._id': { $in: objectIds } },
    { $set: { 'items.$[elem].paidToContractor': true } },
    {
      arrayFilters: [{ 'elem._id': { $in: objectIds } }],
      multi: true,
    } as any,
  );

  return res.json({ updated: result.modifiedCount ?? 0 });
});

invoicesRouter.get('/', async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };

  const filter: any = { isCancelled: { $ne: true } };
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const docs = await InvoiceModel.find(filter)
    .populate('driver')
    .populate('createdBy')
    .sort({ date: -1 })
    .limit(200);

  const invoices = docs.map((inv: any) => {
    const driver = inv.driver || null;
    const manager = inv.createdBy || null;

    return {
      _id: String(inv._id),
      number: inv.number ?? '',
      date: inv.date,
      supplier: inv.supplier ?? '',
      client: inv.client ?? '',
      totalAmount: inv.totalAmount ?? 0,
      totalIncome: inv.totalIncome ?? 0,
      paymentType: inv.paymentType ?? undefined,
      isCancelled: inv.isCancelled ?? false,
      driverId: driver ? String(driver._id) : null,
      driverName: driver ? String(driver.fullName || '') : null,
      managerId: manager ? String(manager._id) : null,
      managerName: manager ? String(manager.fullName || manager.email || '') : null,
    };
  });

  return res.json({ invoices });
});

// Архив накладных (аннулированные)
invoicesRouter.get('/archived', async (req: AuthRequest, res) => {
  try {
    const { from, to } = req.query as { from?: string; to?: string };

    const filter: any = { isCancelled: true };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    const invoices = await InvoiceModel.find(filter).sort({ date: -1 }).limit(200);
    return res.json({ invoices });
  } catch (err) {
    console.error('Error in /invoices/archived', err);
    return res.status(500).json({ message: 'Ошибка загрузки архива накладных' });
  }
});

// Отчёт по накладным (дубликат маршрута выше, но расположен до /:id, чтобы не ловить "report" как id)
invoicesRouter.get('/report', async (req: AuthRequest, res) => {
  try {
    const { from, to, client, groupBy } = req.query as {
      from?: string;
      to?: string;
      client?: string;
      groupBy?: 'day' | 'month' | string;
    };

    const match: any = { isCancelled: { $ne: true } };

    if (from || to) {
      match.date = {};
      if (from) {
        const dFrom = new Date(from);
        if (!Number.isNaN(dFrom.getTime())) {
          match.date.$gte = dFrom;
        }
      }
      if (to) {
        const dTo = new Date(to);
        if (!Number.isNaN(dTo.getTime())) {
          match.date.$lte = dTo;
        }
      }
    }

    if (client && client.trim()) {
      match.client = client.trim();
    }

    const gb = groupBy === 'month' ? 'month' : 'day';
    const format = gb === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const pipeline = [
      { $match: match },
      // защищаемся от битых дат в документе
      { $match: { date: { $type: 'date' } } },
      {
        $group: {
          _id: {
            period: {
              $dateToString: {
                format,
                date: '$date',
              },
            },
          },
          totalSales: { $sum: '$totalAmount' },
          totalIncome: { $sum: '$totalIncome' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          totalSales: 1,
          totalIncome: 1,
          count: 1,
        },
      },
      { $sort: { period: 1 } },
    ];

    const rows = await (InvoiceModel as any).aggregate(pipeline);

    const summary = rows.reduce(
      (acc: { totalSales: number; totalIncome: number; count: number }, r: any) => {
        acc.totalSales += Number(r.totalSales) || 0;
        acc.totalIncome += Number(r.totalIncome) || 0;
        acc.count += Number(r.count) || 0;
        return acc;
      },
      { totalSales: 0, totalIncome: 0, count: 0 },
    );

    return res.json({ rows, summary });
  } catch (err) {
    console.error('Error in /invoices/report (top handler)', err);
    return res.status(500).json({ message: 'Ошибка формирования отчёта по накладным' });
  }
});

// Получить полную накладную по id
invoicesRouter.get('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const invoice = await InvoiceModel.findById(id).populate({
    path: 'items.product',
    select: 'sku name unit purchasePriceCash purchasePriceCashless lastSalePrice',
  });
  if (!invoice) {
    return res.status(404).json({ message: 'Накладная не найдена' });
  }

  return res.json({ invoice });
});

// Загрузить/обновить вложения накладной: photo и/или scan
invoicesRouter.post(
  '/:id/attachments',
  invoiceAttachmentsUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'scan', maxCount: 1 },
  ]),
  async (req: AuthRequest, res) => {
    const { id } = req.params;

    const invoice = await InvoiceModel.findById(id);
    if (!invoice) {
      return res.status(404).json({ message: 'Накладная не найдена' });
    }

    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    const photo = Array.isArray(files.photo) ? files.photo[0] : null;
    const scan = Array.isArray(files.scan) ? files.scan[0] : null;

    if (!photo && !scan) {
      return res.status(400).json({ message: 'Файлы не переданы' });
    }

    const deleteIfExists = (existingRelPath: any) => {
      try {
        const rel = String(existingRelPath || '');
        if (!rel.startsWith('/uploads/')) return;
        const abs = path.join(__dirname, '..', '..', rel.replace(/^\//, ''));
        if (fs.existsSync(abs)) {
          fs.unlinkSync(abs);
        }
      } catch {
        // игнорируем ошибки удаления
      }
    };

    if (photo) {
      deleteIfExists((invoice as any).photoFile);
      (invoice as any).photoFile = `/uploads/invoice-attachments/${photo.filename}`;
    }
    if (scan) {
      deleteIfExists((invoice as any).scanFile);
      (invoice as any).scanFile = `/uploads/invoice-attachments/${scan.filename}`;
    }

    await invoice.save();
    return res.json({ invoice });
  }
);

// Удалить вложение накладной: photo или scan
invoicesRouter.delete('/:id/attachments/:type', async (req: AuthRequest, res) => {
  const { id, type } = req.params as { id: string; type: string };
  if (type !== 'photo' && type !== 'scan') {
    return res.status(400).json({ message: 'type must be photo|scan' });
  }

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) {
    return res.status(404).json({ message: 'Накладная не найдена' });
  }

  const field = type === 'photo' ? 'photoFile' : 'scanFile';
  const existing = (invoice as any)[field];

  try {
    const rel = String(existing || '');
    if (rel.startsWith('/uploads/')) {
      const abs = path.join(__dirname, '..', '..', rel.replace(/^\//, ''));
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
      }
    }
  } catch {
    // игнор
  }

  (invoice as any)[field] = null;
  await invoice.save();

  return res.json({ invoice });
});

// Сформировать PDF по накладной
invoicesRouter.get('/:id/pdf', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) {
    return res.status(404).json({ message: 'Накладная не найдена' });
  }

  const fileNameSafe = (invoice.number || String(invoice._id)).toString().replace(/[^0-9A-Za-zА-Яа-я_-]+/g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Invoice-${fileNameSafe}.pdf"`);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
  };

  const formatDate = (d: Date | string | undefined) => {
    if (!d) return '';
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString('ru-RU');
  };

  // Шапка
  doc.fontSize(18).text('GlobalSnab', { align: 'left' });
  doc.moveDown(0.5);

  doc.fontSize(14).text(`Накладная № ${invoice.number || ''}`, { align: 'left' });
  doc.fontSize(12).text(`от ${formatDate(invoice.date as any)}`, { align: 'left' });
  doc.moveDown(1);

  doc.fontSize(11);
  doc.text(`Поставщик: ${invoice.supplier || ''}`);
  doc.moveDown(0.3);
  doc.text(`Покупатель: ${invoice.client || ''}`);
  doc.moveDown(0.3);
  const pType = (invoice as any).paymentType === 'cash' ? 'Наличная оплата' : 'Безналичная оплата';
  doc.text(`Тип продажи: ${pType}`);
  doc.moveDown(1);

  // Таблица товаров
  const startY = doc.y;
  const colX = {
    index: 40,
    name: 70,
    unit: 320,
    qty: 360,
    price: 420,
    amount: 500,
  } as const;

  doc.fontSize(10).text('№', colX.index, startY);
  doc.text('Товар', colX.name, startY);
  doc.text('Ед.', colX.unit, startY);
  doc.text('Кол-во', colX.qty, startY, { width: 50, align: 'right' });
  doc.text('Цена', colX.price, startY, { width: 60, align: 'right' });
  doc.text('Сумма', colX.amount, startY, { width: 70, align: 'right' });

  doc.moveTo(40, startY + 14).lineTo(555, startY + 14).stroke();

  let y = startY + 20;
  const lineHeight = 14;

  (invoice.items || []).forEach((item: any, idx: number) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.salePrice) || 0;
    const amount = qty * price;

    // Перенос на новую страницу, если не хватает места
    if (y > doc.page.height - doc.page.margins.bottom - 40) {
      doc.addPage();
      y = doc.y;
    }

    doc.fontSize(10);
    doc.text(String(idx + 1), colX.index, y);
    doc.text(item.name || '', colX.name, y, { width: 240 });
    doc.text(item.unit || 'шт', colX.unit, y);
    doc.text(formatMoney(qty), colX.qty, y, { width: 50, align: 'right' });
    doc.text(formatMoney(price), colX.price, y, { width: 60, align: 'right' });
    doc.text(formatMoney(amount), colX.amount, y, { width: 70, align: 'right' });

    y += lineHeight;
  });

  doc.moveDown(2);

  const total = Number((invoice as any).totalAmount) || 0;
  doc.fontSize(12).text(`Итого: ${formatMoney(total)} ₽`, { align: 'right' });

  doc.end();
});

// Отчёт по накладным: суммы продаж и дохода по периодам (день/месяц) с фильтром по клиенту
invoicesRouter.get('/report', async (req: AuthRequest, res) => {
  try {
    const { from, to, client, groupBy } = req.query as {
      from?: string;
      to?: string;
      client?: string;
      groupBy?: 'day' | 'month' | string;
    };

    const match: any = { isCancelled: { $ne: true } };

    if (from || to) {
      match.date = {};
      if (from) {
        const dFrom = new Date(from);
        if (!Number.isNaN(dFrom.getTime())) {
          match.date.$gte = dFrom;
        }
      }
      if (to) {
        const dTo = new Date(to);
        if (!Number.isNaN(dTo.getTime())) {
          match.date.$lte = dTo;
        }
      }
    }

    if (client && client.trim()) {
      match.client = client.trim();
    }

    const gb = groupBy === 'month' ? 'month' : 'day';
    const format = gb === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const pipeline = [
      { $match: match },
      // защищаемся от битых дат в документе
      { $match: { date: { $type: 'date' } } },
      {
        $group: {
          _id: {
            period: {
              $dateToString: {
                format,
                date: '$date',
              },
            },
          },
          totalSales: { $sum: '$totalAmount' },
          totalIncome: { $sum: '$totalIncome' },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          period: '$_id.period',
          totalSales: 1,
          totalIncome: 1,
          count: 1,
        },
      },
      { $sort: { period: 1 } },
    ];

    const rows = await (InvoiceModel as any).aggregate(pipeline);

    const summary = rows.reduce(
      (acc: { totalSales: number; totalIncome: number; count: number }, r: any) => {
        acc.totalSales += Number(r.totalSales) || 0;
        acc.totalIncome += Number(r.totalIncome) || 0;
        acc.count += Number(r.count) || 0;
        return acc;
      },
      { totalSales: 0, totalIncome: 0, count: 0 },
    );

    return res.json({ rows, summary });
  } catch (err) {
    console.error('Error in /invoices/report', err);
    return res.status(500).json({ message: 'Ошибка формирования отчёта по накладным' });
  }
});

// Архив накладных (аннулированные)
invoicesRouter.get('/archived', async (req: AuthRequest, res) => {
  try {
    // ВРЕМЕННО: отдаём пустой архив без обращения к БД,
    // чтобы страница "Архив накладных" работала без 500.
    // Позже сюда вернём реальную выборку из Mongo.
    return res.json({ invoices: [] });
  } catch (err) {
    console.error('Error in /invoices/archived', err);
    return res.status(500).json({ message: 'Ошибка загрузки архива накладных' });
  }
});

invoicesRouter.post('/', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const body = req.body as any;

  let totalAmount = 0;
  let totalIncome = 0;

  const paymentType = body.paymentType === 'cash' ? 'cash' : body.paymentType === 'cashless' ? 'cashless' : 'cashless';

  const normalizeName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[<>"']/g, '')
      .replace(/[,.;:]+/g, '')
      .trim();
  };

  for (const item of body.items || []) {
    const rawName = typeof item.name === 'string' ? item.name.trim() : '';
    const rawSku = typeof item.sku === 'string' ? item.sku.trim() : '';

    if (!rawName && !rawSku) continue;

    let product = null as any;

    // 1) если есть sku — сначала ищем по нему
    if (rawSku) {
      const normalizeSku = (v: string) => v.replace(/\s+/g, '').toLowerCase();
      const skuNorm = normalizeSku(rawSku);

      product = await ProductModel.findOne({
        sku: { $regex: new RegExp('^' + skuNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      });
    }

    // 2) если по sku не нашли — пробуем по имени, как раньше
    if (!product && rawName) {
      const norm = normalizeName(rawName);
      if (!norm) continue;

      const escapedExact = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      product = await ProductModel.findOne({
        name: { $regex: new RegExp('^' + escapedExact + '$', 'i') },
      });

      if (!product) {
        const escapedPart = norm.split(' ').slice(0, 3).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (escapedPart.length > 2) {
          product = await ProductModel.findOne({
            name: { $regex: new RegExp(escapedPart, 'i') },
          });
        }
      }
    }

    if (product) {
      item.product = product._id;

      if (item.purchasePriceCash == null && typeof product.purchasePriceCash === 'number') {
        item.purchasePriceCash = product.purchasePriceCash;
      }
      if (item.purchasePriceCashless == null && typeof product.purchasePriceCashless === 'number') {
        item.purchasePriceCashless = product.purchasePriceCashless;
      }
      if (item.salePrice == null && typeof product.lastSalePrice === 'number') {
        item.salePrice = product.lastSalePrice;
      }
    }
  }

  for (const item of body.items || []) {
    const qty = Number(item.quantity) || 0;
    const sale = Number(item.salePrice) || 0;

    const purchaseCash = item.purchasePriceCash != null ? Number(item.purchasePriceCash) : undefined;
    const purchaseCashless = item.purchasePriceCashless != null ? Number(item.purchasePriceCashless) : undefined;

    // Для совместимости оставим purchasePrice как выбранную приходную цену по типу оплаты
    let effectivePurchase = 0;
    if (paymentType === 'cash') {
      effectivePurchase = purchaseCash ?? purchaseCashless ?? 0;
    } else {
      effectivePurchase = purchaseCashless ?? purchaseCash ?? 0;
    }

    item.purchasePrice = effectivePurchase;

    const income = (sale - effectivePurchase) * qty;
    item.income = income;

    totalAmount += sale * qty;
    totalIncome += income;
  }
  const deliveryPrice =
    typeof body.deliveryPrice === 'number' ? body.deliveryPrice : Number(body.deliveryPrice || 0) || 0;
  body.totalAmount = totalAmount + deliveryPrice;
  body.totalIncome = totalIncome;
  if (body.clientId) {
    body.clientRef = body.clientId;
  } else {
    const rawClientName = typeof body.client === 'string' ? body.client.trim() : '';
    if (rawClientName) {
      const escaped = rawClientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingClient = await ClientModel.findOne({ name: new RegExp('^' + escaped + '$', 'i') });
      const clientDoc =
        existingClient ||
        (await ClientModel.create({
          name: rawClientName,
        }));
      body.clientRef = clientDoc._id;
    }
  }
  // Привязка машины по выбранному водителю, если указано
  if (body.driver) {
    const driver = await DriverModel.findById(body.driver);
    if (driver) {
      (body as any).car = driver.car ?? null;
    }
  }
  body.createdBy = req.user.id;

  const invoice = await InvoiceModel.create(body);

  // Обновление склада и карточек товаров
  for (const item of invoice.items) {
    if (item.product) {
      const product = await ProductModel.findById(item.product);
      if (product) {
        if (typeof item.purchasePriceCash === 'number' && !Number.isNaN(item.purchasePriceCash)) {
          product.purchasePriceCash = item.purchasePriceCash;
        }
        if (typeof item.purchasePriceCashless === 'number' && !Number.isNaN(item.purchasePriceCashless)) {
          product.purchasePriceCashless = item.purchasePriceCashless;
        }
        if (typeof item.salePrice === 'number' && !Number.isNaN(item.salePrice)) {
          product.lastSalePrice = item.salePrice;
        }
        await product.save();
      }
    }

    if (item.contractor === 'НАШ СКЛАД' && item.product) {
      let wh = await WarehouseItemModel.findOne({ product: item.product });
      if (!wh) {
        wh = await WarehouseItemModel.create({
          product: item.product,
          currentStock: 0,
          minStock: 0,
        });
      }

      wh.currentStock -= item.quantity;
      wh.lastOutDate = new Date();
      await wh.save();
    }
  }

  return res.status(201).json({ invoice });
});

// Обновление существующей накладной с откатом и повторным применением движения по складу
invoicesRouter.put('/:id', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  const existing = await InvoiceModel.findById(id);
  if (!existing) {
    return res.status(404).json({ message: 'Накладная не найдена' });
  }

  if ((existing as any).isCancelled) {
    return res.status(400).json({ message: 'Нельзя редактировать аннулированную накладную' });
  }

  // Откат склада по старой версии накладной
  for (const item of existing.items) {
    if (item.contractor === 'НАШ СКЛАД' && item.product) {
      const wh = await WarehouseItemModel.findOne({ product: item.product });
      if (wh) {
        wh.currentStock += item.quantity;
        wh.lastInDate = new Date();
        await wh.save();
      }
    }
  }

  const body = req.body as any;

  let totalAmount = 0;
  let totalIncome = 0;

  const paymentType = body.paymentType === 'cash' ? 'cash' : body.paymentType === 'cashless' ? 'cashless' : 'cashless';

  const normalizeName = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[<>"']/g, '')
      .replace(/[,.;:]+/g, '')
      .trim();
  };

  // Привязка товаров и автоподстановка цен, как при создании
  for (const item of body.items || []) {
    const rawName = typeof item.name === 'string' ? item.name.trim() : '';
    const rawSku = typeof item.sku === 'string' ? item.sku.trim() : '';

    if (!rawName && !rawSku) continue;

    let product = null as any;

    if (rawSku) {
      const normalizeSku = (v: string) => v.replace(/\s+/g, '').toLowerCase();
      const skuNorm = normalizeSku(rawSku);

      product = await ProductModel.findOne({
        sku: { $regex: new RegExp('^' + skuNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      });
    }

    if (!product && rawName) {
      const norm = normalizeName(rawName);
      if (!norm) continue;

      const escapedExact = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      product = await ProductModel.findOne({
        name: { $regex: new RegExp('^' + escapedExact + '$', 'i') },
      });

      if (!product) {
        const escapedPart = norm.split(' ').slice(0, 3).join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (escapedPart.length > 2) {
          product = await ProductModel.findOne({
            name: { $regex: new RegExp(escapedPart, 'i') },
          });
        }
      }
    }

    if (product) {
      item.product = product._id;

      if (item.purchasePriceCash == null && typeof product.purchasePriceCash === 'number') {
        item.purchasePriceCash = product.purchasePriceCash;
      }
      if (item.purchasePriceCashless == null && typeof product.purchasePriceCashless === 'number') {
        item.purchasePriceCashless = product.purchasePriceCashless;
      }
      if (item.salePrice == null && typeof product.lastSalePrice === 'number') {
        item.salePrice = product.lastSalePrice;
      }
    }
  }

  // Пересчёт сумм и дохода
  for (const item of body.items || []) {
    const qty = Number(item.quantity) || 0;
    const sale = Number(item.salePrice) || 0;

    const purchaseCash = item.purchasePriceCash != null ? Number(item.purchasePriceCash) : undefined;
    const purchaseCashless = item.purchasePriceCashless != null ? Number(item.purchasePriceCashless) : undefined;

    let effectivePurchase = 0;
    if (paymentType === 'cash') {
      effectivePurchase = purchaseCash ?? purchaseCashless ?? 0;
    } else {
      effectivePurchase = purchaseCashless ?? purchaseCash ?? 0;
    }

    item.purchasePrice = effectivePurchase;

    const income = (sale - effectivePurchase) * qty;
    item.income = income;

    totalAmount += sale * qty;
    totalIncome += income;
  }

  const deliveryPriceForUpdate =
    typeof body.deliveryPrice === 'number' ? body.deliveryPrice : Number(body.deliveryPrice || 0) || 0;
  body.totalAmount = totalAmount + deliveryPriceForUpdate;
  body.totalIncome = totalIncome;
  body.paymentType = paymentType;
  if (body.clientId) {
    body.clientRef = body.clientId;
  } else {
    const rawClientName = typeof body.client === 'string' ? body.client.trim() : '';
    if (rawClientName) {
      const escaped = rawClientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const existingClient = await ClientModel.findOne({ name: new RegExp('^' + escaped + '$', 'i') });
      const clientDoc =
        existingClient ||
        (await ClientModel.create({
          name: rawClientName,
        }));
      body.clientRef = clientDoc._id;
    } else {
      body.clientRef = undefined;
    }
  }
  // Привязка машины по выбранному водителю, если указано
  if (body.driver) {
    const driver = await DriverModel.findById(body.driver);
    if (driver) {
      (body as any).car = driver.car ?? null;
    }
  }
  body.createdBy = existing.createdBy;
  body.isCancelled = false;

  const updatedInvoice = await InvoiceModel.findByIdAndUpdate(id, body, { new: true });
  if (!updatedInvoice) {
    return res.status(500).json({ message: 'Ошибка при сохранении накладной' });
  }

  // Обновляем цены в карточке товара и снова применяем движение по складу
  for (const item of updatedInvoice.items) {
    if (item.product) {
      const product = await ProductModel.findById(item.product);
      if (product) {
        if (typeof item.purchasePriceCash === 'number' && !Number.isNaN(item.purchasePriceCash)) {
          product.purchasePriceCash = item.purchasePriceCash;
        }
        if (typeof item.purchasePriceCashless === 'number' && !Number.isNaN(item.purchasePriceCashless)) {
          product.purchasePriceCashless = item.purchasePriceCashless;
        }
        if (typeof item.salePrice === 'number' && !Number.isNaN(item.salePrice)) {
          product.lastSalePrice = item.salePrice;
        }
        await product.save();
      }
    }

    if (item.contractor === 'НАШ СКЛАД' && item.product) {
      let wh = await WarehouseItemModel.findOne({ product: item.product });
      if (!wh) {
        wh = await WarehouseItemModel.create({
          product: item.product,
          currentStock: 0,
          minStock: 0,
        });
      }

      wh.currentStock -= item.quantity;
      wh.lastOutDate = new Date();
      await wh.save();
    }
  }

  return res.json({ invoice: updatedInvoice });
});

// Аннулирование накладной по id: откат склада по строкам НАШ СКЛАД и пометка isCancelled
invoicesRouter.delete('/:id', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) {
    return res.status(404).json({ message: 'Накладная не найдена' });
  }

  if (!invoice.isModified('isCancelled') && (invoice as any).isCancelled) {
    // уже аннулирована, просто выходим
    return res.json({ success: true, cancelled: true });
  }

  // Возвращаем на склад все позиции НАШЕГО СКЛАДА
  for (const item of invoice.items) {
    if (item.contractor === 'НАШ СКЛАД' && item.product) {
      const wh = await WarehouseItemModel.findOne({ product: item.product });
      if (wh) {
        wh.currentStock += item.quantity;
        wh.lastInDate = new Date();
        await wh.save();
      }
    }
  }

  (invoice as any).isCancelled = true;
  await invoice.save();

  return res.json({ success: true, cancelled: true });
});

// Восстановление ранее аннулированной накладной: повторное списание со склада по строкам НАШ СКЛАД и снятие флага isCancelled
invoicesRouter.post('/:id/restore', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;

  const invoice = await InvoiceModel.findById(id);
  if (!invoice) {
    return res.status(404).json({ message: 'Накладная не найдена' });
  }

  if (!(invoice as any).isCancelled) {
    // уже активна, просто возвращаем
    return res.json({ success: true, restored: false });
  }

  // Снова списываем со склада все позиции НАШЕГО СКЛАДА
  for (const item of invoice.items) {
    if (item.contractor === 'НАШ СКЛАД' && item.product) {
      let wh = await WarehouseItemModel.findOne({ product: item.product });
      if (!wh) {
        wh = await WarehouseItemModel.create({
          product: item.product,
          currentStock: 0,
          minStock: 0,
        });
      }

      wh.currentStock -= item.quantity;
      wh.lastOutDate = new Date();
      await wh.save();
    }
  }

  (invoice as any).isCancelled = false;
  await invoice.save();

  return res.json({ success: true, restored: true });
});
