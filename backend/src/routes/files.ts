import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { UserFileModel } from '../models/UserFile';
import { UserModel } from '../models/User';
import { emitToUser } from '../realtime/io';

export const filesRouter = Router();

filesRouter.use(authMiddleware);

const userFilesDir = path.join(__dirname, '..', '..', 'uploads', 'user-files');
if (!fs.existsSync(userFilesDir)) {
  fs.mkdirSync(userFilesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, userFilesDir);
  },
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

filesRouter.post('/send', upload.single('file'), async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const toUserId = String((req.body as any)?.toUserId || '');
  if (!toUserId) {
    return res.status(400).json({ message: 'toUserId is required' });
  }

  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return res.status(400).json({ message: 'File is required' });
  }

  const toUser = await UserModel.findById(toUserId).select('_id fullName isActive');
  if (!toUser || !toUser.isActive) {
    return res.status(404).json({ message: 'Recipient not found' });
  }

  const record = await UserFileModel.create({
    fromUserId: req.user.id,
    toUserId,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    storagePath: file.filename,
  });

  const fromUser = await UserModel.findById(req.user.id).select('_id fullName');

  const payload = {
    id: String(record._id),
    fromUserId: req.user.id,
    fromName: fromUser?.fullName || 'Пользователь',
    toUserId,
    originalName: record.originalName,
    mimeType: record.mimeType,
    size: record.size,
    createdAt: record.createdAt,
  };

  emitToUser(toUserId, 'file:incoming', payload);

  return res.status(201).json({ file: payload });
});

filesRouter.get('/:id/download', async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { id } = req.params;
  const record = await UserFileModel.findById(id);
  if (!record) {
    return res.status(404).json({ message: 'File not found' });
  }

  const userId = req.user.id;
  if (record.fromUserId !== userId && record.toUserId !== userId) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const fullPath = path.join(userFilesDir, record.storagePath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ message: 'File missing on disk' });
  }

  res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(record.originalName)}"`);

  return res.sendFile(fullPath);
});
