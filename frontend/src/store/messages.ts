import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import axios from 'axios';
import { getSocket } from '../realtime/socket';
import { useAuthStore } from './auth';

export type ConversationRow = {
  conversationId: string;
  otherUser: { id: string; fullName: string; email?: string; role?: string };
  lastMessage: { id: string; fromUserId: string; toUserId: string; text: string; createdAt: string };
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  fromUserId: string;
  toUserId: string;
  text: string;
  createdAt: string;
  pending?: boolean;
};

export const useMessagesStore = defineStore('messages', () => {
  const auth = useAuthStore();
  const sock = getSocket();

  const conversations = ref<ConversationRow[]>([]);
  const activeOtherUserId = ref<string | null>(null);
  const activeConversationId = ref<string | null>(null);
  const messages = ref<ChatMessage[]>([]);

  const isLoadingConversations = ref(false);
  const isLoadingMessages = ref(false);
  const error = ref('');

  const typingUserIds = ref<Set<string>>(new Set());
  const typingTimers = new Map<string, number>();

  let ownTypingTimer: number | null = null;
  let isTypingSent = false;

  const notifyTyping = (toUserId: string) => {
    if (!isTypingSent) {
      sock.emit('typing:start', { toUserId });
      isTypingSent = true;
    }
    if (ownTypingTimer) clearTimeout(ownTypingTimer);
    ownTypingTimer = window.setTimeout(() => {
      sock.emit('typing:stop', { toUserId });
      isTypingSent = false;
      ownTypingTimer = null;
    }, 2500);
  };

  const isTyping = (userId: string) => typingUserIds.value.has(userId);

  const activeConversation = computed(() => {
    if (!activeOtherUserId.value) return null;
    return conversations.value.find((c) => c.otherUser.id === activeOtherUserId.value) || null;
  });

  const refreshConversations = async () => {
    error.value = '';
    isLoadingConversations.value = true;
    try {
      const res = await axios.get('/api/v1/messages/conversations');
      conversations.value = res.data.conversations || [];
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || 'Ошибка загрузки диалогов';
    } finally {
      isLoadingConversations.value = false;
    }
  };

  const openChat = async (otherUserId: string) => {
    error.value = '';
    activeOtherUserId.value = otherUserId;
    isLoadingMessages.value = true;
    try {
      const res = await axios.get(`/api/v1/messages/with/${otherUserId}`);
      activeConversationId.value = res.data.conversationId;
      messages.value = (res.data.messages || []).map((m: any) => ({
        id: m.id,
        conversationId: res.data.conversationId,
        fromUserId: m.fromUserId,
        toUserId: m.toUserId,
        text: m.text,
        createdAt: m.createdAt,
      }));
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || 'Ошибка загрузки сообщений';
    } finally {
      isLoadingMessages.value = false;
    }
  };

  const sendMessage = async (text: string) => {
    const t = text.trim();
    if (!t) return;
    const me = auth.user?.id;
    const other = activeOtherUserId.value;
    if (!me || !other) return;

    const conversationId = activeConversationId.value || [me, other].sort().join(':');
    const tempId = 'tmp-' + Date.now() + '-' + Math.random().toString(16).slice(2);

    const optimistic: ChatMessage = {
      id: tempId,
      conversationId,
      fromUserId: me,
      toUserId: other,
      text: t,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    messages.value = [...messages.value, optimistic];

    // realtime
    sock.emit('message:send', { toUserId: other, text: t });

    // also persist via HTTP as fallback (in case socket is down)
    try {
      await axios.post(`/api/v1/messages/with/${other}`, { text: t });
    } catch {
      // ignore
    }
  };

  const bindSocketEvents = () => {
    sock.off('message:new');
    sock.off('typing:start');
    sock.off('typing:stop');

    sock.on('typing:start', (data: { fromUserId: string }) => {
      if (!data?.fromUserId) return;
      const uid = String(data.fromUserId);
      typingUserIds.value.add(uid);
      typingUserIds.value = new Set(typingUserIds.value);
      if (typingTimers.has(uid)) clearTimeout(typingTimers.get(uid)!);
      const t = window.setTimeout(() => {
        typingUserIds.value.delete(uid);
        typingUserIds.value = new Set(typingUserIds.value);
        typingTimers.delete(uid);
      }, 4000);
      typingTimers.set(uid, t);
    });

    sock.on('typing:stop', (data: { fromUserId: string }) => {
      if (!data?.fromUserId) return;
      const uid = String(data.fromUserId);
      if (typingTimers.has(uid)) { clearTimeout(typingTimers.get(uid)!); typingTimers.delete(uid); }
      typingUserIds.value.delete(uid);
      typingUserIds.value = new Set(typingUserIds.value);
    });

    sock.on('message:new', async (data: any) => {
      const me = auth.user?.id;
      if (!me) return;

      const msg: ChatMessage = {
        id: String(data.id),
        conversationId: String(data.conversationId),
        fromUserId: String(data.fromUserId),
        toUserId: String(data.toUserId),
        text: String(data.text || ''),
        createdAt: String(data.createdAt || new Date().toISOString()),
      };

      // If it is for active chat, append
      const otherId = msg.fromUserId === me ? msg.toUserId : msg.fromUserId;
      if (activeOtherUserId.value && otherId === activeOtherUserId.value) {
        // remove pending duplicates
        messages.value = messages.value.filter((m) => !(m.pending && m.text === msg.text && m.toUserId === msg.toUserId));
        messages.value = [...messages.value, msg];
      }

      // refresh conversations list lazily
      await refreshConversations();
      if (activeOtherUserId.value && !activeConversationId.value) {
        activeConversationId.value = [me, activeOtherUserId.value].sort().join(':');
      }
    });
  };

  const init = async () => {
    bindSocketEvents();
    await refreshConversations();
  };

  return {
    conversations,
    activeOtherUserId,
    activeConversationId,
    activeConversation,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    error,
    typingUserIds,
    isTyping,
    notifyTyping,
    init,
    refreshConversations,
    openChat,
    sendMessage,
  };
});
