<template>
  <div class="h-[calc(100vh-7rem)] md:h-[calc(100vh-6rem)]">
    <div class="h-full grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <section class="h-full bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between">
          <div class="font-semibold">Сообщения</div>
          <button
            type="button"
            class="text-xs text-slate-300 hover:text-white"
            @click="messages.refreshConversations"
          >
            Обновить
          </button>
        </div>

        <div class="p-3">
          <input
            v-model="query"
            class="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-sm"
            placeholder="Поиск диалога"
          />
        </div>

        <div v-if="messages.isLoadingConversations" class="p-4 text-sm text-slate-400">Загрузка...</div>
        <div v-else class="overflow-auto h-[calc(100%-120px)]">
          <button
            v-for="c in filteredConversations"
            :key="c.conversationId"
            type="button"
            class="w-full text-left px-4 py-3 border-b border-slate-900 hover:bg-slate-900/60 transition-colors"
            :class="messages.activeOtherUserId === c.otherUser.id ? 'bg-slate-800/60' : ''"
            @click="messages.openChat(c.otherUser.id)"
          >
            <div class="flex items-center gap-3">
              <div class="relative shrink-0">
                <div class="h-9 w-9 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white">
                  {{ initials(c.otherUser.fullName) }}
                </div>
                <span
                  class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950"
                  :class="calls.isOnline(c.otherUser.id) ? 'bg-emerald-400' : 'bg-slate-600'"
                ></span>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium truncate text-sm">{{ c.otherUser.fullName }}</div>
                  <div class="text-[10px] text-slate-500 whitespace-nowrap shrink-0">{{ formatTime(c.lastMessage.createdAt) }}</div>
                </div>
                <div class="text-xs text-slate-400 truncate">
                  <span v-if="messages.isTyping(c.otherUser.id)" class="text-sky-400">печатает…</span>
                  <span v-else>{{ c.lastMessage.text }}</span>
                </div>
              </div>
            </div>
          </button>

          <div v-if="!filteredConversations.length" class="p-4 text-sm text-slate-400">
            Пока нет диалогов. Открой «Звонки» и отправь файл или напиши первое сообщение.
          </div>
        </div>
      </section>

      <section class="h-full bg-slate-950/60 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        <div class="p-4 border-b border-slate-800 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <div v-if="messages.activeOtherUserId" class="relative shrink-0">
              <div class="h-10 w-10 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                {{ initials(messages.activeConversation?.otherUser.fullName || '') }}
              </div>
              <span
                class="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950"
                :class="messages.activeOtherUserId && calls.isOnline(messages.activeOtherUserId) ? 'bg-emerald-400' : 'bg-slate-600'"
              ></span>
            </div>
            <div class="min-w-0">
              <div class="font-semibold truncate">
                {{ messages.activeConversation?.otherUser.fullName || 'Выбери диалог' }}
              </div>
              <div class="text-xs truncate">
                <span v-if="messages.activeOtherUserId && messages.isTyping(messages.activeOtherUserId)" class="text-sky-400">печатает…</span>
                <span v-else-if="messages.activeOtherUserId && calls.isOnline(messages.activeOtherUserId)" class="text-emerald-400">в сети</span>
                <span v-else-if="messages.activeOtherUserId && calls.getLastSeenTs(messages.activeOtherUserId)" class="text-slate-500">был(а) {{ calls.formatLastSeen(calls.getLastSeenTs(messages.activeOtherUserId)) }}</span>
                <span v-else-if="messages.activeConversation?.otherUser.email" class="text-slate-400">{{ messages.activeConversation?.otherUser.email }}</span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              class="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
              :disabled="!messages.activeOtherUserId"
              @click="callUser('audio')"
              title="Аудиозвонок"
            >
              <svg class="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.5 6.5c1.5-1.5 3.5-1.5 5 0l1.5 1.5c.5.5.5 1.5 0 2l-1 1c1 2 2.5 3.5 4.5 4.5l1-1c.5-.5 1.5-.5 2 0l1.5 1.5c1.5 1.5 1.5 3.5 0 5C15 23 3 11 2.5 6.5z"/>
              </svg>
            </button>
            <button
              type="button"
              class="h-9 w-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
              :disabled="!messages.activeOtherUserId"
              @click="callUser('video')"
              title="Видеозвонок"
            >
              <svg class="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.55-2.28A1 1 0 0121 8.73v6.54a1 1 0 01-1.45.9L15 14M3 8h12a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 011-1z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-auto p-4 space-y-3" ref="scrollBox">
          <div v-if="messages.isLoadingMessages" class="text-sm text-slate-400">Загрузка сообщений...</div>

          <div
            v-for="m in messages.messages"
            :key="m.id"
            class="max-w-[82%] rounded-2xl px-3 py-2 text-sm"
            :class="isMine(m) ? 'ml-auto bg-sky-600/70 text-white' : 'mr-auto bg-slate-900 text-slate-100 border border-slate-800'"
          >
            <div class="whitespace-pre-wrap break-words">{{ m.text }}</div>
            <div class="text-[10px] mt-1 opacity-80 flex items-center justify-end gap-2">
              <span>{{ formatTime(m.createdAt) }}</span>
              <span v-if="m.pending">…</span>
            </div>
          </div>

          <div v-if="messages.error" class="text-sm text-red-300">{{ messages.error }}</div>
        </div>

        <form class="p-3 border-t border-slate-800 flex items-center gap-2" @submit.prevent="send">
          <input
            v-model="input"
            class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-600"
            :disabled="!messages.activeOtherUserId"
            placeholder="Сообщение…"
            @input="onInput"
          />
          <button
            type="submit"
            class="h-9 w-9 rounded-xl bg-sky-600 hover:bg-sky-500 flex items-center justify-center shrink-0 disabled:opacity-40"
            :disabled="!messages.activeOtherUserId || !input.trim()"
          >
            <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useMessagesStore } from '../../store/messages';
import { useCallsStore, type CallKind } from '../../store/calls';
import { useAuthStore } from '../../store/auth';

const messages = useMessagesStore();
const calls = useCallsStore();
const auth = useAuthStore();

const query = ref('');
const input = ref('');
const scrollBox = ref<HTMLDivElement | null>(null);

const filteredConversations = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return messages.conversations;
  return messages.conversations.filter((c) => (c.otherUser.fullName || '').toLowerCase().includes(q));
});

const initials = (name: string) =>
  (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

const isMine = (m: any) => {
  return m.fromUserId === auth.user?.id;
};

const formatTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const onInput = () => {
  if (messages.activeOtherUserId) {
    messages.notifyTyping(messages.activeOtherUserId);
  }
};

const send = async () => {
  const t = input.value;
  input.value = '';
  await messages.sendMessage(t);
  await nextTick();
  scrollBox.value?.scrollTo({ top: scrollBox.value.scrollHeight, behavior: 'smooth' });
};

const callUser = async (kind: CallKind) => {
  if (!messages.activeOtherUserId) return;
  const u = calls.users.find((x) => x.id === messages.activeOtherUserId);
  if (!u) {
    await calls.refreshUsers();
  }
  const user = calls.users.find((x) => x.id === messages.activeOtherUserId);
  if (!user) return;
  await calls.startCall(user, kind);
};

watch(
  () => messages.messages.length,
  async () => {
    await nextTick();
    scrollBox.value?.scrollTo({ top: scrollBox.value.scrollHeight });
  }
);

onMounted(async () => {
  await calls.init();
  await messages.init();
});
</script>
