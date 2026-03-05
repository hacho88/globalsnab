<template>
  <div>
    <div
      v-if="incoming"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-700 p-5 shadow-2xl">
        <div class="text-center">
          <div class="text-xs text-slate-400 mb-2">Входящий звонок</div>
          <div class="text-xl font-semibold mb-1">{{ incoming.fromName }}</div>
          <div class="text-sm text-slate-300 mb-6">
            {{ incoming.kind === 'video' ? 'Видео' : 'Аудио' }} звонок
          </div>
        </div>

        <div class="flex items-center justify-center gap-4">
          <button
            type="button"
            class="h-14 w-14 rounded-full bg-red-600 hover:bg-red-500 text-white text-lg"
            @click="calls.rejectIncoming"
            aria-label="Отклонить"
            title="Отклонить"
          >
            ✕
          </button>

          <button
            type="button"
            class="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-lg"
            @click="calls.acceptIncoming"
            aria-label="Принять"
            title="Принять"
          >
            ✓
          </button>
        </div>

        <div class="text-[11px] text-slate-500 text-center mt-5">
          Если экран заблокирован, открой приложение (PWA) для ответа.
        </div>
      </div>
    </div>

    <div v-if="call" class="fixed inset-0 z-[210] bg-black">
      <div class="absolute inset-0">
        <video
          ref="remoteVideo"
          class="absolute inset-0 w-full h-full object-cover"
          autoplay
          playsinline
        ></video>

        <div class="absolute inset-x-0 top-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div class="flex items-start justify-between gap-4">
            <div>
              <div class="text-lg font-semibold leading-tight">{{ call.peerName }}</div>
              <div class="text-xs text-slate-300 mt-1">
                <span v-if="call.state === 'calling'">Звоним…</span>
                <span v-else-if="call.state === 'connecting'">Соединение…</span>
                <span v-else>
                  {{ durationText }}
                </span>
                <span class="ml-2 text-slate-400">· {{ call.kind === 'video' ? 'Видео' : 'Аудио' }}</span>
              </div>
            </div>

            <div class="text-right">
              <div class="text-[11px] text-slate-300">{{ calls.statsText }}</div>
              <div class="text-[11px] text-slate-400">{{ calls.qualityText }}</div>
            </div>
          </div>
        </div>

        <video
          v-if="call.kind === 'video'"
          ref="localVideo"
          class="absolute bottom-28 right-4 w-36 h-52 md:w-40 md:h-56 rounded-xl border border-white/20 bg-black object-cover shadow-xl"
          autoplay
          muted
          playsinline
        ></video>

        <div class="absolute inset-x-0 bottom-0 p-5 pb-7 bg-gradient-to-t from-black/80 to-transparent">
          <div class="flex items-center justify-center gap-4">
            <button
              type="button"
              class="h-14 w-14 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-white"
              @click="calls.toggleMute"
              :title="calls.isMuted ? 'Включить микрофон' : 'Выключить микрофон'"
            >
              {{ calls.isMuted ? '🔇' : '🎙️' }}
            </button>

            <button
              v-if="call.kind === 'video'"
              type="button"
              class="h-14 w-14 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-white"
              @click="calls.toggleCamera"
              :title="calls.isCameraOff ? 'Включить камеру' : 'Выключить камеру'"
            >
              {{ calls.isCameraOff ? '🚫' : '📷' }}
            </button>

            <button
              type="button"
              class="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 text-white text-lg shadow-2xl"
              @click="calls.hangup"
              title="Завершить"
            >
              ⏏
            </button>

            <button
              type="button"
              class="h-14 w-14 rounded-full border border-white/15 bg-white/10 hover:bg-white/15 text-white"
              @click="toggleSpeaker"
              :title="speakerSupported ? (speakerOn ? 'Выключить громкую связь' : 'Громкая связь') : 'Не поддерживается в этом браузере'"
              :disabled="!speakerSupported"
            >
              {{ speakerOn ? '🔊' : '🔈' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="incomingFile" class="fixed inset-0 z-[205] flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-700 p-5 shadow-2xl">
        <div class="text-sm font-semibold mb-1">Получен файл</div>
        <div class="text-xs text-slate-300 mb-1">От: {{ incomingFile.fromName }}</div>
        <div class="text-xs text-slate-300 mb-4">
          {{ incomingFile.originalName }} ({{ calls.formatBytes(incomingFile.size) }})
        </div>

        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs"
            @click="calls.dismissIncomingFile"
          >
            Закрыть
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs"
            :disabled="calls.isDownloading"
            @click="calls.downloadIncomingFile"
          >
            {{ calls.isDownloading ? 'Скачиваем…' : 'Скачать' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useCallsStore } from '../store/calls';

const calls = useCallsStore();
const { call, incoming, incomingFile } = storeToRefs(calls);

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);

const speakerOn = ref(false);
const speakerSupported = computed(() => {
  const el = remoteVideo.value as any;
  return !!el && typeof el.setSinkId === 'function';
});

const durationText = computed(() => {
  if (!call.value || !call.value.startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((Date.now() - call.value.startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
});

const toggleSpeaker = async () => {
  if (!speakerSupported.value) return;
  speakerOn.value = !speakerOn.value;
  try {
    // In browsers that support it, switching output requires a deviceId.
    // We'll try to keep default output; on many devices it maps to speaker.
    // On iOS Safari this is typically not supported.
    const el = remoteVideo.value as any;
    await el.setSinkId('default');
  } catch {
    speakerOn.value = false;
  }
};

const attachStreams = () => {
  if (remoteVideo.value) {
    remoteVideo.value.srcObject = calls.remoteStream || null;
  }
  if (localVideo.value) {
    localVideo.value.srcObject = calls.localStream || null;
  }
};

onMounted(async () => {
  await calls.init();
  attachStreams();
});

watch(
  () => [calls.localStream, calls.remoteStream, call.value?.callId],
  () => {
    attachStreams();
  }
);
</script>
