import { Router } from 'express';
import { authMiddleware, AuthRequest } from '../middlewares/auth';
import { MessageModel } from '../models/Message';
import { UserModel } from '../models/User';

const makeConversationId = (a: string, b: string) => {
  return [a, b].sort().join(':');
};

export const messagesRouter = Router();
messagesRouter.use(authMiddleware);

// Список диалогов: последний месседж по каждой переписке
messagesRouter.get('/conversations', async (req: AuthRequest, res) => {
  const me = req.user?.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });

  const pipeline: any[] = [
    {
      $match: {
        $or: [{ fromUserId: me }, { toUserId: me }],
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
      },
    },
    { $sort: { 'lastMessage.createdAt': -1 } },
  ];

  const rows = await (MessageModel as any).aggregate(pipeline);

  const otherIds = new Set<string>();
  for (const r of rows) {
    const m = r.lastMessage;
    const other = m.fromUserId === me ? m.toUserId : m.fromUserId;
    otherIds.add(String(other));
  }

  const users = await UserModel.find({ _id: { $in: Array.from(otherIds) } }).select('_id fullName email role');
  const map = new Map<string, any>();
  for (const u of users) {
    map.set(String(u._id), { id: String(u._id), fullName: u.fullName, email: u.email, role: u.role });
  }

  return res.json({
    conversations: rows.map((r: any) => {
      const m = r.lastMessage;
      const otherId = m.fromUserId === me ? m.toUserId : m.fromUserId;
      return {
        conversationId: String(r._id),
        otherUser: map.get(String(otherId)) || { id: String(otherId), fullName: 'Пользователь' },
        lastMessage: {
          id: String(m._id),
          fromUserId: m.fromUserId,
          toUserId: m.toUserId,
          text: m.text,
          createdAt: m.createdAt,
        },
      };
    }),
  });
});

// История сообщений с конкретным пользователем
messagesRouter.get('/with/:userId', async (req: AuthRequest, res) => {
  const me = req.user?.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });

  const otherId = String(req.params.userId);
  const convId = makeConversationId(me, otherId);

  const messages = await MessageModel.find({ conversationId: convId })
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();

  return res.json({
    conversationId: convId,
    messages: messages.map((m: any) => ({
      id: String(m._id),
      fromUserId: m.fromUserId,
      toUserId: m.toUserId,
      text: m.text,
      createdAt: m.createdAt,
      readAt: m.readAt || null,
    })),
  });
});

// Отправка сообщения (fallback без сокета)
messagesRouter.post('/with/:userId', async (req: AuthRequest, res) => {
  const me = req.user?.id;
  if (!me) return res.status(401).json({ message: 'Unauthorized' });

  const otherId = String(req.params.userId);
  const text = String((req.body as any)?.text || '').trim();
  if (!text) return res.status(400).json({ message: 'text is required' });

  const convId = makeConversationId(me, otherId);
  const msg = await MessageModel.create({
    conversationId: convId,
    fromUserId: me,
    toUserId: otherId,
    text,
  });

  return res.status(201).json({
    message: {
      id: String(msg._id),
      conversationId: convId,
      fromUserId: me,
      toUserId: otherId,
      text: msg.text,
      createdAt: msg.createdAt,
    },
  });
});
