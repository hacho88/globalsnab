import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { DriverModel } from '../models/Driver';
import { CarModel } from '../models/Car';

export const driversRouter = Router();

// Все маршруты требуют авторизации
driversRouter.use(authMiddleware as any);

// Список водителей с привязанной машиной
driversRouter.get('/', async (_req, res) => {
  const drivers = await DriverModel.find().populate('car').sort({ createdAt: -1 });
  res.json({ drivers });
});

// Создать водителя
driversRouter.post('/', async (req: AuthRequest, res) => {
  const { fullName, phone, carId } = req.body as { fullName: string; phone?: string; carId?: string };

  if (!fullName) {
    return res.status(400).json({ message: 'fullName обязателен' });
  }

  let car = undefined;
  if (carId) {
    car = await CarModel.findById(carId);
    if (!car) {
      return res.status(400).json({ message: 'Автомобиль не найден' });
    }
  }

  const driver = await DriverModel.create({ fullName, phone, car: carId });
  const populated = await DriverModel.findById(driver._id).populate('car');
  res.status(201).json({ driver: populated });
});

// Обновить водителя
driversRouter.put('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { fullName, phone, carId, isActive } = req.body as {
    fullName?: string;
    phone?: string;
    carId?: string | null;
    isActive?: boolean;
  };

  const update: any = {};
  if (typeof fullName === 'string') update.fullName = fullName;
  if (typeof phone === 'string') update.phone = phone;
  if (typeof isActive === 'boolean') update.isActive = isActive;

  if (carId === null) {
    update.car = undefined;
  } else if (typeof carId === 'string') {
    const car = await CarModel.findById(carId);
    if (!car) {
      return res.status(400).json({ message: 'Автомобиль не найден' });
    }
    update.car = carId;
  }

  const driver = await DriverModel.findByIdAndUpdate(id, update, { new: true }).populate('car');
  if (!driver) {
    return res.status(404).json({ message: 'Водитель не найден' });
  }

  res.json({ driver });
});

// Деактивировать водителя
driversRouter.delete('/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;
  const driver = await DriverModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!driver) {
    return res.status(404).json({ message: 'Водитель не найден' });
  }
  res.json({ driver });
});
