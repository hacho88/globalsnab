import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { authMiddleware, AuthRequest, requireRole } from '../middlewares/auth';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await UserModel.findOne({ email: email.toLowerCase() });
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const accessToken = signAccessToken(user.id, user.role);
  const refreshToken = signRefreshToken(user.id, user.role);

  const secureCookie = process.env.NODE_ENV === 'production';

  // Prefer httpOnly cookie for refresh token (silent refresh)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: secureCookie,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      permissions: (user as any).permissions || {},
    },
    accessToken,
    refreshToken,
  });
});

authRouter.post('/refresh', async (req, res) => {
  const cookieToken = (req as any).cookies?.refreshToken;
  const bodyToken = (req.body as any)?.refreshToken;
  const token = (cookieToken || bodyToken || '').toString();
  if (!token) {
    return res.status(401).json({ message: 'No refresh token' });
  }

  try {
    const payload = verifyRefreshToken(token);
    const user = await UserModel.findById(payload.sub);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const accessToken = signAccessToken(user.id, user.role);
    const nextRefreshToken = signRefreshToken(user.id, user.role);

    const secureCookie = process.env.NODE_ENV === 'production';

    res.cookie('refreshToken', nextRefreshToken, {
      httpOnly: true,
      secure: secureCookie,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        permissions: (user as any).permissions || {},
      },
      accessToken,
      refreshToken: nextRefreshToken,
    });
  } catch {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }
});

authRouter.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const user = await UserModel.findById(req.user.id).select('-passwordHash');
  return res.json({ user });
});

// Создание нового пользователя (по умолчанию менеджер) — только для админов
authRouter.post('/users', authMiddleware, requireRole(['admin']), async (req, res) => {
  const { email, fullName, password, role } = req.body as {
    email: string;
    fullName: string;
    password: string;
    role?: 'admin' | 'manager';
  };

  if (!email || !fullName || !password) {
    return res.status(400).json({ message: 'email, fullName и password обязательны' });
  }

  const existing = await UserModel.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.create({
    email: email.toLowerCase(),
    fullName,
    passwordHash,
    role: role || 'manager',
    isActive: true,
  });

  const safeUser = await UserModel.findById(user._id).select('-passwordHash');
  return res.status(201).json({ user: safeUser });
});

const ensureAdmin = async () => {
  const passwordHash = await bcrypt.hash('Admin123!', 10);

  const admin = await UserModel.findOneAndUpdate(
    { email: 'admin@globalsnab.local' },
    {
      email: 'admin@globalsnab.local',
      passwordHash,
      fullName: 'GlobalSnab Admin',
      role: 'admin',
      isActive: true,
    },
    { new: true, upsert: true }
  );

  return admin;
};

authRouter.post('/seed-admin', async (_req, res) => {
  const admin = await ensureAdmin();

  return res.json({
    message: 'Admin user ensured',
    credentials: {
      email: admin.email,
      password: 'Admin123!',
    },
  });
});

authRouter.get('/seed-admin', async (_req, res) => {
  const admin = await ensureAdmin();

  return res.json({
    message: 'Admin user ensured',
    credentials: {
      email: admin.email,
      password: 'Admin123!',
    },
  });
});

authRouter.get('/users', authMiddleware, requireRole(['admin']), async (_req: AuthRequest, res) => {
  const users = await UserModel.find().select('-passwordHash');
  return res.json({ users });
});

authRouter.put('/users/:id', authMiddleware, requireRole(['admin']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { email, fullName, role, isActive } = req.body as {
    email?: string;
    fullName?: string;
    role?: 'admin' | 'manager';
    isActive?: boolean;
  };

  if (!email && !fullName && !role && typeof isActive !== 'boolean') {
    return res.status(400).json({ message: 'Нет данных для обновления' });
  }

  const current = await UserModel.findById(id);
  if (!current) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (req.user?.id === id && role && role !== current.role) {
    return res.status(400).json({ message: 'Нельзя менять свою роль' });
  }

  const nextRole = role || current.role;
  if (current.role === 'admin' && nextRole !== 'admin') {
    const adminsCount = await UserModel.countDocuments({ role: 'admin' });
    if (adminsCount <= 1) {
      return res.status(400).json({ message: 'Нельзя понизить последнего администратора' });
    }
  }

  if (email) {
    const normalized = email.toLowerCase();
    const existing = await UserModel.findOne({ email: normalized, _id: { $ne: id } });
    if (existing) {
      return res.status(400).json({ message: 'Пользователь с таким email уже существует' });
    }
  }

  const update: Record<string, any> = {};
  if (email) update.email = email.toLowerCase();
  if (fullName) update.fullName = fullName;
  if (role) update.role = role;
  if (typeof isActive === 'boolean') update.isActive = isActive;

  const user = await UserModel.findByIdAndUpdate(id, { $set: update }, { new: true }).select('-passwordHash');
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({ user });
});

authRouter.delete('/users/:id', authMiddleware, requireRole(['admin']), async (req: AuthRequest, res) => {
  const { id } = req.params;

  if (req.user?.id === id) {
    return res.status(400).json({ message: 'Нельзя удалить себя' });
  }

  const current = await UserModel.findById(id);
  if (!current) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (current.role === 'admin') {
    const adminsCount = await UserModel.countDocuments({ role: 'admin' });
    if (adminsCount <= 1) {
      return res.status(400).json({ message: 'Нельзя удалить последнего администратора' });
    }
  }

  await UserModel.findByIdAndDelete(id);
  return res.json({ ok: true });
});

// Обновление прав (permissions) пользователя — только для админов
authRouter.put('/users/:id/permissions', authMiddleware, requireRole(['admin']), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { permissions } = req.body as { permissions?: Record<string, boolean> };

  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ message: 'permissions object is required' });
  }

  const user = await UserModel.findByIdAndUpdate(
    id,
    { $set: { permissions } },
    { new: true }
  ).select('-passwordHash');

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({ user });
});
