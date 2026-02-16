import { Router } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middlewares/auth';
import { WarehouseItemModel } from '../models/WarehouseItem';

export const warehouseRouter = Router();

warehouseRouter.use(authMiddleware);

// Получить список позиций склада с данными товара
warehouseRouter.get('/', async (_req: AuthRequest, res) => {
  const items = await WarehouseItemModel.find({}).populate('product').sort({ createdAt: -1 });
  return res.json({ items });
});

// Движение по складу: приход / списание по товару
warehouseRouter.post('/:productId/move', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { productId } = req.params;
  const { type, quantity } = req.body as { type: 'in' | 'out'; quantity: number };

  const qty = Number(quantity);
  if (!type || (type !== 'in' && type !== 'out') || !Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ message: 'type must be in|out and quantity must be positive number' });
  }

  let wh = await WarehouseItemModel.findOne({ product: productId });
  if (!wh) {
    wh = await WarehouseItemModel.create({ product: productId, currentStock: 0, minStock: 0 });
  }

  if (type === 'in') {
    wh.currentStock += qty;
    wh.lastInDate = new Date();
  } else {
    wh.currentStock -= qty;
    wh.lastOutDate = new Date();
  }

  await wh.save();

  return res.json({ item: wh });
});

// Удалить позицию склада по id (не удаляя сам товар из общей базы)
warehouseRouter.delete('/:id', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;

  const deleted = await WarehouseItemModel.findByIdAndDelete(id);
  if (!deleted) {
    return res.status(404).json({ message: 'Позиция склада не найдена' });
  }

  return res.json({ success: true });
});
