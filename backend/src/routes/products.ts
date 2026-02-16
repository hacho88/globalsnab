import { Router } from 'express';
import multer from 'multer';
import { ProductModel } from '../models/Product';
import { authMiddleware, requireRole, AuthRequest } from '../middlewares/auth';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const productsRouter = Router();

productsRouter.use(authMiddleware);

productsRouter.get('/', async (_req: AuthRequest, res) => {
  // По умолчанию отдаём только активные товары
  const products = await ProductModel.find({ isActive: { $ne: false } }).sort({ name: 1 });
  return res.json({ products });
});

// Архив (неактивные) товары
productsRouter.get('/archived', async (_req: AuthRequest, res) => {
  const products = await ProductModel.find({ isActive: false }).sort({ name: 1 });
  return res.json({ products });
});

productsRouter.post('/', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const body = req.body;
  const product = await ProductModel.create(body);
  return res.status(201).json({ product });
});

// Архивирование всех товаров (isActive=false). Только для админа.
productsRouter.delete('/all', requireRole(['admin']), async (_req: AuthRequest, res) => {
  const result = await ProductModel.updateMany({}, { $set: { isActive: false } });
  return res.json({ archived: result.modifiedCount ?? 0 });
});

// Архивирование выбранных товаров по списку id (isActive=false). Только для админа.
productsRouter.post('/bulk-delete', requireRole(['admin']), async (req: AuthRequest, res) => {
  const ids = (req.body?.ids ?? []) as string[];

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'ids array is required' });
  }

  const result = await ProductModel.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
  return res.json({ archived: result.modifiedCount ?? 0 });
});

productsRouter.put('/:id', requireRole(['admin', 'manager']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const product = await ProductModel.findByIdAndUpdate(id, req.body, { new: true });
  return res.json({ product });
});

// Архивирование одного товара (isActive=false). Только для админа.
productsRouter.delete('/:id', requireRole(['admin']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const product = await ProductModel.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true });
  if (!product) {
    return res.status(404).json({ message: 'Товар не найден' });
  }
  return res.json({ product });
});

productsRouter.post('/import', requireRole(['admin', 'manager']), upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File is required' });
  }

  const { format } = req.body as { format: 'excel' | 'csv' | 'json' };

  if (format === 'json') {
    const text = req.file.buffer.toString('utf8');
    const parsed = JSON.parse(text) as any;

    // Поддерживаем два формата:
    // 1) [ { name, price, ... }, ... ]
    // 2) { meta: {...}, products: [ { name, price, ... }, ... ] }
    const rawArray: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as any).products)
      ? (parsed as any).products
      : [];

    if (!Array.isArray(rawArray) || rawArray.length === 0) {
      return res.status(400).json({ message: 'JSON must be an array of objects or contain a products[] array' });
    }

    const bulk = rawArray
      .map((p) => {
        // 1) Пытаемся вытащить имя/цену из обычных полей
        let rawName: unknown = (p as any).name ?? (p as any).IE_NAME ?? (p as any).ie_name;
        let rawPrice: unknown = (p as any).CR_PRICE_1_RUB ?? (p as any).price;

        // 2) Специальный формат: одно поле "IE_NAME;CR_PRICE_1_RUB": "Имя;123.45"
        const combined: unknown = (p as any)['IE_NAME;CR_PRICE_1_RUB'];
        if (typeof combined === 'string' && combined.trim() !== '') {
          const parts = combined.split(';');
          const namePart = parts[0] ?? '';
          const pricePart = parts[parts.length - 1] ?? '';

          if (!rawName || String(rawName).trim() === '') {
            rawName = namePart;
          }
          if (!rawPrice || String(rawPrice).trim() === '') {
            rawPrice = pricePart;
          }
        }

        let name = typeof rawName === 'string' ? rawName.trim() : '';

        // Отбрасываем явно "служебные" HTML-строки из названия
        if (name === '</p>' || name.startsWith('<')) {
          name = '';
        }

        // Цена из CR_PRICE_1_RUB или разобранного комбинированного поля
        let parsedPrice: number | null = null;
        if (typeof rawPrice === 'number') {
          parsedPrice = rawPrice;
        } else if (typeof rawPrice === 'string' && rawPrice.trim() !== '') {
          const cleaned = rawPrice.replace(/\s+/g, '').replace(',', '.');
          const num = Number(cleaned);
          parsedPrice = Number.isFinite(num) ? num : null;
        }

        return {
          name,
          sku: (p as any).sku ?? (p as any).id ?? null,
          category: (p as any).category ?? null,
          unit: (p as any).unit ?? 'шт',
          description: (p as any).description ?? null,
          imageUrl: (p as any).imageUrl ?? (p as any).IE_DETAIL_PICTURE ?? null,
          baseSource: (p as any).baseSource ?? null,
          purchasePriceCash: (p as any).purchasePriceCash ?? null,
          purchasePriceCashless: (p as any).purchasePriceCashless ?? null,
          lastSalePrice: (p as any).lastSalePrice ?? parsedPrice,
          isActive: (p as any).isActive ?? true,
        };
      })
      .filter((p) => p.name.length > 0);

    if (bulk.length === 0) {
      return res.json({ imported: 0 });
    }

    const result = await ProductModel.insertMany(bulk, { ordered: false });

    // После импорта сразу перенумеровываем артикулы для всех товаров с 0001
    const allProducts = await ProductModel.find({}).sort({ name: 1 });
    let counter = 0;
    for (const p of allProducts) {
      counter += 1;
      const sku = counter.toString().padStart(4, '0');
      if (p.sku !== sku) {
        p.sku = sku;
        await p.save();
      }
    }

    return res.json({ imported: result.length, reassignedSku: allProducts.length });
  }

  return res.status(400).json({ message: 'Only json import implemented yet' });
});

// Полная перенумерация артикулов для всех товаров: 0001, 0002, 0003, ...
productsRouter.post('/assign-sku', requireRole(['admin']), async (_req: AuthRequest, res) => {
  const allProducts = await ProductModel.find({}).sort({ name: 1 });

  if (allProducts.length === 0) {
    return res.json({ updated: 0 });
  }

  let counter = 0;

  for (const p of allProducts) {
    counter += 1;
    const sku = counter.toString().padStart(4, '0');
    p.sku = sku;
    await p.save();
  }

  return res.json({ updated: allProducts.length });
});

