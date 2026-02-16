import { Router } from 'express';
import { AuthRequest, authMiddleware } from '../middlewares/auth';
import { CheckModel } from '../models/Check';
import { findOrgByInn } from '../services/dadata.service';

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

// Список чеков (история) с фильтром по дате
checksRouter.get('/', async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };

  const filter: any = {};
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
  const { id } = req.params;
  const check = await CheckModel.findById(id);
  if (!check) {
    return res.status(404).json({ message: 'Чек не найден' });
  }
  return res.json({ check });
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
    const last = await CheckModel.findOne().sort({ createdAt: -1 }).lean();
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

  const doc = await CheckModel.create({
    number: numberStr,
    date,
    items: normalizedItems,
    totalAmount,
    comment: body.comment || null,
    shopName: body.shopName || null,
    shopAddress: body.shopAddress || null,
    shopContacts: body.shopContacts || null,
    createdBy: req.user.id,
  });

  return res.status(201).json({ check: doc });
});
