import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { UserModel } from '../models/User';

export const usersRouter = Router();

usersRouter.get('/', authMiddleware, async (req: AuthRequest, res) => {
  const currentUserId = req.user?.id;
  const users = await UserModel.find({ isActive: true })
    .select('_id email fullName role isActive')
    .sort({ fullName: 1 });

  return res.json({
    users: users.map((u) => ({
      id: String(u._id),
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      isActive: u.isActive,
      isMe: currentUserId ? String(u._id) === currentUserId : false,
    })),
  });
});
