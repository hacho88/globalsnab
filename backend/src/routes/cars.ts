import { Router } from 'express';
import { authMiddleware, AuthRequest, requireRole } from '../middlewares/auth';
import { CarModel } from '../models/Car';
import { CarExpenseModel } from '../models/CarExpense';

export const carsRouter = Router();

// Все роуты автопарка требуют авторизации, права будем контролировать на фронте
carsRouter.use(authMiddleware as any);

// Список автомобилей
carsRouter.get('/', async (_req, res) => {
  const cars = await CarModel.find().sort({ createdAt: -1 });
  res.json({ cars });
});

// Создание автомобиля
carsRouter.post('/', async (req: AuthRequest, res) => {
  const { name, plateNumber, brand, model, year, vin, fuelType, oilChangeIntervalKm, driverSharePercent } = req.body;

  if (!name || !plateNumber) {
    return res.status(400).json({ message: 'name и plateNumber обязательны' });
  }

  const car = await CarModel.create({
    name,
    plateNumber,
    brand,
    model,
    year,
    vin,
    fuelType,
    oilChangeIntervalKm,
    driverSharePercent,
  });

  res.status(201).json({ car });
});

// Обновление автомобиля
carsRouter.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const update = req.body || {};

  const car = await CarModel.findByIdAndUpdate(id, update, { new: true });
  if (!car) {
    return res.status(404).json({ message: 'Автомобиль не найден' });
  }

  res.json({ car });
});

// Полное удаление автомобиля и всех его расходов
carsRouter.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  const car = await CarModel.findById(id);
  if (!car) {
    return res.status(404).json({ message: 'Автомобиль не найден' });
  }

  await CarExpenseModel.deleteMany({ car: id });
  await CarModel.deleteOne({ _id: id });

  res.json({ car });
});

// Список расходов по автомобилю
carsRouter.get('/:id/expenses', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const expenses = await CarExpenseModel.find({ car: id }).sort({ date: -1, createdAt: -1 });
  res.json({ expenses });
});

// Добавить расход по автомобилю (ГСМ, ТО, ГАИ, страховка и т.д.)
carsRouter.post('/:id/expenses', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { date, type, amount, description, odometer } = req.body;

  if (!date || !type || !amount) {
    return res.status(400).json({ message: 'date, type и amount обязательны' });
  }

  const expense = await CarExpenseModel.create({
    car: id,
    date,
    type,
    amount,
    description,
    odometer,
  });

  // по желанию можно обновлять текущий пробег у машины, если передан odometer
  if (typeof odometer === 'number') {
    await CarModel.findByIdAndUpdate(id, { currentOdometer: odometer });
  }

  res.status(201).json({ expense });
});
