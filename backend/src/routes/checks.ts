import { Router } from 'express';
import { AuthRequest, authMiddleware } from '../middlewares/auth';
import { CheckModel } from '../models/Check';
import { findOrgByInn } from '../services/dadata.service';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

export const checksRouter = Router();

checksRouter.use(authMiddleware as any);

// Поиск организации по ИНН через DaData для автозаполнения реквизитов в чеке
checksRouter.get('/org-by-inn', async (req: AuthRequest, res) => {
  const { inn } = req.query as { inn?: string };

  const query = (inn || '').trim();
  if (!query) {
    return res.status(400).json({ message: 'inn is required' });
  }

  try {
    const org = await findOrgByInn(query);
    if (!org) {
      return res.json({ org: null });
    }

    return res.json({ org });
  } catch (err) {
    console.error('Error in /checks/org-by-inn', err);
    return res.status(500).json({ message: 'Ошибка поиска организации по ИНН' });
  }
});

// Удалить чек
checksRouter.delete('/:id', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;
  const deleted = await CheckModel.findOneAndDelete({ _id: id, createdBy: req.user.id }).lean();
  if (!deleted) {
    return res.status(404).json({ message: 'Чек не найден' });
  }
  return res.json({ ok: true });
});

// Удалить все чеки текущего пользователя
checksRouter.delete('/', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const result = await CheckModel.deleteMany({ createdBy: req.user.id });
  return res.json({ ok: true, deletedCount: result.deletedCount || 0 });
});

// Список чеков (история) с фильтром по дате
checksRouter.get('/', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { from, to } = req.query as { from?: string; to?: string };

  const filter: any = {};
  filter.createdBy = req.user.id;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }

  const checks = await CheckModel.find(filter).sort({ date: -1 }).limit(200);
  return res.json({ checks });
});

// Получить чек по id
checksRouter.get('/:id', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;
  const check = await CheckModel.findOne({ _id: id, createdBy: req.user.id });
  if (!check) {
    return res.status(404).json({ message: 'Чек не найден' });
  }
  return res.json({ check });
});

// Обновить существующий чек
checksRouter.put('/:id', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;
  const body = req.body as any;

  const check = await CheckModel.findOne({ _id: id, createdBy: req.user.id });
  if (!check) {
    return res.status(404).json({ message: 'Чек не найден' });
  }

  const date = body.date ? new Date(body.date) : check.date;
  const items = Array.isArray(body.items) ? body.items : [];

  let totalAmount = 0;
  const normalizedItems = items
    .filter((it: any) => it && (it.name || it.sku))
    .map((it: any) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const amount = qty * price;
      totalAmount += amount;
      return {
        product: it.product || null,
        sku: typeof it.sku === 'string' ? it.sku : it.productSku || null,
        name: String(it.name || ''),
        quantity: qty,
        price,
        amount,
      };
    });

  check.number = String(body.number || check.number);
  check.date = date;
  check.items = normalizedItems as any;
  check.totalAmount = totalAmount;
  check.comment = body.comment || null;
  check.shopName = body.shopName || null;
  check.shopAddress = body.shopAddress || null;
  check.shopContacts = body.shopContacts || null;
  check.buyerInn = body.buyerInn || null;
  check.buyerName = body.buyerName || null;
  check.buyerAddress = body.buyerAddress || null;

  try {
    await check.save();
    return res.json({ check });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Номер чека уже используется' });
    }
    console.error('Error updating check', err);
    return res.status(500).json({ message: 'Ошибка при обновлении чека' });
  }
});

// Создать новый чек (автонумерация)
checksRouter.post('/', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const body = req.body as any;

  // Автонумерация: берём последний чек и увеличиваем номер как целое число
  let numberStr = body.number as string | undefined;
  if (!numberStr) {
    const last = await CheckModel.findOne({ createdBy: req.user.id }).sort({ createdAt: -1 }).lean();
    const lastNum = last ? parseInt(String(last.number), 10) || 0 : 0;
    numberStr = String(lastNum + 1);
  }

  const date = body.date ? new Date(body.date) : new Date();

  const items = Array.isArray(body.items) ? body.items : [];

  let totalAmount = 0;
  const normalizedItems = items
    .filter((it: any) => it && (it.name || it.sku))
    .map((it: any) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const amount = qty * price;
      totalAmount += amount;
      return {
        product: it.product || null,
        sku: typeof it.sku === 'string' ? it.sku : it.productSku || null,
        name: String(it.name || ''),
        quantity: qty,
        price,
        amount,
      };
    });

  try {
    const doc = await CheckModel.create({
      number: numberStr,
      date,
      items: normalizedItems,
      totalAmount,
      comment: body.comment || null,
      shopName: body.shopName || null,
      shopAddress: body.shopAddress || null,
      shopContacts: body.shopContacts || null,
      buyerInn: body.buyerInn || null,
      buyerName: body.buyerName || null,
      buyerAddress: body.buyerAddress || null,
      createdBy: req.user.id,
    });

    return res.status(201).json({ check: doc });
  } catch (err: any) {
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Номер чека уже используется' });
    }
    console.error('Error creating check', err);
    return res.status(500).json({ message: 'Ошибка при сохранении чека' });
  }
});

checksRouter.post('/:id/send-email', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { to } = req.body as { to?: string };

  const email = String(to || '').trim();
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  const host = (env.smtpHost || '').trim();
  const port = Number(env.smtpPort || 0);
  const user = (env.smtpUser || '').trim();
  const pass = (env.smtpPass || '').trim();
  const from = (env.smtpFrom || '').trim();

  if (!host || !port || !user || !pass || !from) {
    return res.status(500).json({ message: 'SMTP is not configured' });
  }

  const secure = port === 465;

  const check = await CheckModel.findOne({ _id: id, createdBy: req.user?.id }).lean();
  if (!check) {
    return res.status(404).json({ message: 'Чек не найден' });
  }

  const itemsHtml = (check.items || [])
    .map((it: any, idx: number) => {
      const qty = Number(it.quantity) || 0;
      const price = Number(it.price) || 0;
      const amount = Number(it.amount) || qty * price;
      return `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${idx + 1}</td>
          <td style="padding:6px;border:1px solid #ddd;">${String(it.name || '')}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${qty}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${price.toFixed(2)}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${amount.toFixed(2)}</td>
        </tr>`;
    })
    .join('');

  const subject = `Товарный чек №${check.number}`;

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;color:#111;">
      <h2 style="margin:0 0 8px;">Товарный чек №${check.number}</h2>
      <div style="margin:0 0 12px;">Дата: ${new Date(check.date).toLocaleString('ru-RU')}</div>
      ${check.shopName ? `<div style="margin:0 0 4px;">${String(check.shopName)}</div>` : ''}
      ${check.shopAddress ? `<div style="margin:0 0 4px;">${String(check.shopAddress)}</div>` : ''}
      ${check.shopContacts ? `<div style="margin:0 0 12px;">${String(check.shopContacts)}</div>` : ''}
      <table style="border-collapse:collapse;width:100%;margin:0 0 12px;">
        <thead>
          <tr>
            <th style="padding:6px;border:1px solid #ddd;text-align:left;">№</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left;">Наименование</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:right;">Кол-во</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:right;">Цена</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:right;">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="padding:6px;border:1px solid #ddd;text-align:right;font-weight:bold;">Итого:</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:right;font-weight:bold;">${Number(check.totalAmount || 0).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${check.comment ? `<div>Комментарий: ${String(check.comment)}</div>` : ''}
    </div>
  `;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject,
      html,
    });
    return res.json({ ok: true });
  } catch (err) {
    console.error('Error sending check email', err);
    return res.status(500).json({ message: 'Ошибка отправки email' });
  }
});
