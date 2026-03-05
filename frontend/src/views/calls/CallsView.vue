<template>
  <div class="max-w-5xl mx-auto">
    <div class="flex items-start justify-between gap-4 mb-6">
      <div>
        <div class="text-2xl font-semibold">Звонки</div>
        <div class="text-sm text-slate-400 mt-1">Быстрые аудио/видео звонки и отправка файлов</div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm"
          @click="calls.refreshUsers"
        >
          Обновить
        </button>
      </div>
    </div>

    <div class="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
      <div class="flex items-center gap-3 mb-4">
        <div class="relative flex-1">
          <input
            v-model="calls.query"
            class="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-sky-600"
            placeholder="Поиск пользователя"
          />
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
          </svg>
        </div>
        <label class="flex items-center gap-2 text-xs text-slate-300 select-none">
          <input type="checkbox" v-model="calls.preferMaxQuality" />
          Макс качество
        </label>
      </div>

      <div v-if="calls.isLoading" class="text-sm text-slate-400">Загрузка...</div>
      <div v-else-if="calls.error" class="text-sm text-red-300">{{ calls.error }}</div>
      <div v-else-if="calls.filteredUsers.length === 0" class="text-sm text-slate-400">Нет пользователей</div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          v-for="u in calls.filteredUsers"
          :key="u.id"
          class="rounded-2xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900/60 transition-colors p-4"
        >
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="relative shrink-0">
                <div class="h-11 w-11 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                  {{ initials(u.fullName) }}
                </div>
                <span
                  class="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950"
                  :class="calls.isOnline(u.id) ? 'bg-emerald-400' : 'bg-slate-600'"
                ></span>
              </div>

              <div class="min-w-0">
                <div class="font-semibold truncate">{{ u.fullName }}</div>
                <div class="text-xs truncate">
                  <span v-if="calls.isOnline(u.id)" class="text-emerald-400">в сети</span>
                  <span v-else-if="calls.getLastSeenTs(u.id)" class="text-slate-500">был(а) {{ calls.formatLastSeen(calls.getLastSeenTs(u.id)) }}</span>
                  <span v-else class="text-slate-400">{{ u.email }}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                class="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center disabled:opacity-40"
                :disabled="!canCall(u)"
                @click="calls.startCall(u, 'audio')"
                title="Аудиозвонок"
              >
                <svg class="w-5 h-5 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.5 6.5c1.5-1.5 3.5-1.5 5 0l1.5 1.5c.5.5.5 1.5 0 2l-1 1c1 2 2.5 3.5 4.5 4.5l1-1c.5-.5 1.5-.5 2 0l1.5 1.5c1.5 1.5 1.5 3.5 0 5C15 23 3 11 2.5 6.5z"/>
                </svg>
              </button>
              <button
                type="button"
                class="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center disabled:opacity-40"
                :disabled="!canCall(u)"
                @click="calls.startCall(u, 'video')"
                title="Видеозвонок"
              >
                <svg class="w-5 h-5 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.55-2.28A1 1 0 0121 8.73v6.54a1 1 0 01-1.45.9L15 14M3 8h12a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 011-1z"/>
                </svg>
              </button>
              <button
                type="button"
                class="h-10 w-10 rounded-xl bg-sky-600 hover:bg-sky-500 flex items-center justify-center disabled:opacity-40"
                :disabled="!canSendFile(u)"
                @click="selectFileForUser(u)"
                title="Отправить файл"
              >
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79V17a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h4.21"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17 8l-5 5a2 2 0 01-2.83 0 2 2 0 010-2.83l5-5a2 2 0 112.83 2.83l-5 5a1 1 0 01-1.41 0 1 1 0 010-1.41l5-5"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <input ref="fileInput" type="file" class="hidden" @change="onFilePicked" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useCallsStore, type UserRow } from '../../store/calls';

const calls = useCallsStore();

const fileInput = ref<HTMLInputElement | null>(null);
const fileTargetUser = ref<UserRow | null>(null);

const canCall = (u: UserRow) => {
  return !calls.call && !calls.incoming && u.isActive && !u.isMe;
};

const canSendFile = (u: UserRow) => {
  return !calls.isUploading && u.isActive && !u.isMe;
};

const initials = (name: string) =>
  (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

const selectFileForUser = (u: UserRow) => {
  calls.error = '';
  calls.fileStatus = '';
  fileTargetUser.value = u;
  if (fileInput.value) {
    fileInput.value.value = '';
    fileInput.value.click();
  }
};

const onFilePicked = async (ev: Event) => {
  const input = ev.target as HTMLInputElement;
  const file = input.files && input.files[0];
  const target = fileTargetUser.value;
  fileTargetUser.value = null;
  if (!file || !target) return;
  await calls.sendFile(target.id, file);
};

onMounted(async () => {
  await calls.init();
});
</script>
