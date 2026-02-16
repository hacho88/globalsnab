import { Router } from 'express';
import { CounterpartyModel } from '../models/Counterparty';
import { authMiddleware, requireRole, AuthRequest } from '../middlewares/auth';

export const counterpartiesRouter = Router();

counterpartiesRouter.use(authMiddleware);

// Список активных контрагентов
counterpartiesRouter.get('/', async (_req: AuthRequest, res) => {
  const items = await CounterpartyModel.find({ isActive: { $ne: false } }).sort({ name: 1 });
  return res.json({ counterparties: items });
});

// Архивные контрагенты
counterpartiesRouter.get('/archived', async (_req: AuthRequest, res) => {
  const items = await CounterpartyModel.find({ isActive: false }).sort({ name: 1 });
  return res.json({ counterparties: items });
});

// Создать контрагента
counterpartiesRouter.post('/', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { name, phone } = req.body as { name?: string; phone?: string };

  if (!name || !name.trim()) {
    return res.status(400).json({ message: 'Имя контрагента обязательно' });
  }

  const created = await CounterpartyModel.create({ name: name.trim(), phone: phone?.trim() || undefined });
  return res.status(201).json({ counterparty: created });
});

// Обновить контрагента
counterpartiesRouter.put('/:id', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { name, phone, isActive } = req.body as { name?: string; phone?: string; isActive?: boolean };

  const update: any = {};
  if (name !== undefined) update.name = name.trim();
  if (phone !== undefined) update.phone = phone.trim();
  if (typeof isActive === 'boolean') update.isActive = isActive;

  const updated = await CounterpartyModel.findByIdAndUpdate(id, update, { new: true });
  if (!updated) {
    return res.status(404).json({ message: 'Контрагент не найден' });
  }
  return res.json({ counterparty: updated });
});

// Архивировать (isActive=false)
counterpartiesRouter.delete('/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const updated = await CounterpartyModel.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  if (!updated) {
    return res.status(404).json({ message: 'Контрагент не найден' });
  }
  return res.json({ counterparty: updated });
});
