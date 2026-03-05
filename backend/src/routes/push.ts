import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { PushSubscriptionModel } from '../models/PushSubscription';
import { env } from '../config/env';

export const pushRouter = Router();
pushRouter.use(authMiddleware);

pushRouter.get('/vapid-public-key', (_req, res) => {
  res.json({ publicKey: env.vapidPublicKey || '' });
});

pushRouter.post('/subscribe', async (req: AuthRequest, res) => {
  const me = req.user?.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });

  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ message: 'Invalid subscription' });
  }

  await PushSubscriptionModel.findOneAndUpdate(
    { userId: me, endpoint },
    { userId: me, endpoint, keys },
    { upsert: true, new: true }
  );

  return res.json({ ok: true });
});

pushRouter.delete('/unsubscribe', async (req: AuthRequest, res) => {
  const me = req.user?.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });

  const { endpoint } = req.body as { endpoint: string };
  if (endpoint) {
    await PushSubscriptionModel.deleteOne({ userId: me, endpoint });
  } else {
    await PushSubscriptionModel.deleteMany({ userId: me });
  }
  return res.json({ ok: true });
});
