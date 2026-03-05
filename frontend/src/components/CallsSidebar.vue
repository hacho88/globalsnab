<template>
  <div class="mt-4 pt-4 border-t border-slate-800">
    <button
      class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-slate-800 text-left"
      type="button"
      @click="isOpen = !isOpen"
    >
      <span class="font-semibold">Звонки</span>
      <span class="text-slate-400">{{ isOpen ? '▾' : '▸' }}</span>
    </button>

    <div v-if="calls.isOpen" class="px-3 pt-2 pb-3">
      <div class="flex items-center gap-2 mb-2">
        <input
          v-model="calls.query"
          class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
          placeholder="Поиск пользователя"
        />
      </div>

      <div class="flex items-center justify-between mb-2">
        <label class="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" v-model="calls.preferMaxQuality" />
          Макс качество
        </label>
        <button
          class="text-xs text-slate-300 hover:text-white"
          type="button"
          @click="calls.refreshUsers"
        >
          Обновить
        </button>
      </div>

      <div v-if="calls.isLoading" class="text-xs text-slate-400">Загрузка...</div>
      <div v-else class="space-y-2 max-h-56 overflow-auto pr-1">
        <div
          v-for="u in calls.filteredUsers"
          :key="u.id"
          class="flex items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <div class="text-xs truncate flex items-center gap-2">
              <span
                class="inline-block h-2 w-2 rounded-full"
                :class="calls.isOnline(u.id) ? 'bg-emerald-400' : 'bg-slate-600'"
                :title="calls.isOnline(u.id) ? 'В сети' : 'Не в сети'"
              ></span>
              <span class="truncate">{{ u.fullName }}</span>
            </div>
            <div class="text-[10px] text-slate-400 truncate">{{ u.email }}</div>
            <div v-if="!calls.isOnline(u.id) && calls.getLastSeenTs(u.id)" class="text-[10px] text-slate-500 truncate">
              был(а) {{ calls.formatLastSeen(calls.getLastSeenTs(u.id)) }}
            </div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              type="button"
              :disabled="!canCall(u)"
              @click="calls.startCall(u, 'audio')"
              title="Аудио"
            >
              🎧
            </button>
            <button
              class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              type="button"
              :disabled="!canCall(u)"
              @click="calls.startCall(u, 'video')"
              title="Видео"
            >
              🎥
            </button>
            <button
              class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              type="button"
              :disabled="!canSendFile(u)"
              @click="selectFileForUser(u)"
              title="Файл"
            >
              📎
            </button>
          </div>
        </div>
      </div>

      <div v-if="calls.error" class="text-xs text-red-300 mt-2">{{ calls.error }}</div>
      <div v-if="calls.fileStatus" class="text-xs text-slate-300 mt-2">{{ calls.fileStatus }}</div>
    </div>

    <input
      ref="fileInput"
      class="hidden"
      type="file"
      @change="onFilePicked"
    />

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useCallsStore, UserRow } from '../store/calls';

const calls = useCallsStore();

const fileInput = ref<HTMLInputElement | null>(null);
const fileTargetUser = ref<UserRow | null>(null);

const canCall = (u: UserRow) => {
  return !calls.call && !calls.incoming && u.isActive && !u.isMe;
};

const canSendFile = (u: UserRow) => {
  return !calls.isUploading && u.isActive && !u.isMe;
};

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

const isOpen = computed({
  get: () => calls.isOpen,
  set: (v) => (calls.isOpen = v),
});

watch(
  () => calls.isOpen,
  async (open) => {
    if (open && calls.users.length === 0) {
      await calls.refreshUsers();
    }
  }
);

onMounted(async () => {
  await calls.init();
});
</script>
