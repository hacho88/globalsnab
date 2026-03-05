<template>
  <div>
    <!-- Incoming call -->
    <Transition name="fade-up">
      <div
        v-if="incoming"
        class="fixed inset-0 z-[200] flex items-end justify-center pb-10 md:items-center md:pb-0 bg-black/80 backdrop-blur-sm"
      >
        <div class="w-full max-w-sm mx-4 rounded-3xl bg-slate-900 border border-slate-700/50 p-8 shadow-2xl text-center">
          <div class="relative inline-flex mb-5">
            <div class="h-20 w-20 rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-2xl font-bold shadow-lg text-white">
              {{ initials(incoming.fromName) }}
            </div>
            <span class="absolute inset-0 rounded-full animate-ping bg-sky-400/30 pointer-events-none"></span>
          </div>
          <div class="text-xl font-semibold mb-1">{{ incoming.fromName }}</div>
          <div class="text-sm text-slate-400 mb-8">
            {{ incoming.kind === 'video' ? 'Входящий видеозвонок' : 'Входящий аудиозвонок' }}
          </div>
          <div class="flex items-center justify-center gap-10">
            <div class="flex flex-col items-center gap-2">
              <button
                type="button"
                class="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                @click="calls.rejectIncoming"
              >
                <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
              <span class="text-xs text-slate-400">Отклонить</span>
            </div>
            <div class="flex flex-col items-center gap-2">
              <button
                type="button"
                class="h-16 w-16 rounded-full bg-emerald-500 hover:bg-emerald-400 active:scale-95 transition-all shadow-lg flex items-center justify-center"
                @click="calls.acceptIncoming"
              >
                <svg class="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.5 6.5c1.5-1.5 3.5-1.5 5 0l1.5 1.5c.5.5.5 1.5 0 2l-1 1c1 2 2.5 3.5 4.5 4.5l1-1c.5-.5 1.5-.5 2 0l1.5 1.5c1.5 1.5 1.5 3.5 0 5C15 23 3 11 2.5 6.5z"/>
                </svg>
              </button>
              <span class="text-xs text-slate-400">Принять</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Active call -->
    <Transition name="fade">
      <div v-if="call" class="fixed inset-0 z-[210] bg-black select-none">
        <video ref="remoteVideo" class="absolute inset-0 w-full h-full object-cover" autoplay playsinline></video>
        <div class="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/85 to-transparent pointer-events-none"></div>
        <div class="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 to-transparent pointer-events-none"></div>

        <!-- Top bar -->
        <div class="absolute inset-x-0 top-0 p-5 flex items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold text-white drop-shadow">{{ call.peerName }}</div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-sm text-slate-200">
                <span v-if="call.state === 'calling'">Звоним…</span>
                <span v-else-if="call.state === 'connecting'">Соединение…</span>
                <span v-else class="font-mono tracking-widest">{{ durationText }}</span>
              </span>
              <span class="text-xs text-slate-400">· {{ call.kind === 'video' ? 'Видео' : 'Аудио' }}</span>
            </div>
          </div>
          <div class="text-right shrink-0">
            <div class="text-[11px] text-slate-300 leading-tight">{{ calls.statsText }}</div>
            <div class="text-[11px] text-slate-400">{{ calls.qualityText }}</div>
          </div>
        </div>

        <!-- PiP local video (draggable) -->
        <video
          v-if="call.kind === 'video'"
          ref="localVideo"
          class="absolute rounded-2xl border-2 border-white/20 bg-black object-cover shadow-2xl cursor-grab active:cursor-grabbing touch-none"
          :style="pipStyle"
          autoplay muted playsinline
          @pointerdown="startDrag"
        ></video>

        <!-- Bottom controls -->
        <div class="absolute inset-x-0 bottom-0 p-6 pb-8 flex items-center justify-center gap-4 flex-wrap">
          <!-- Mute -->
          <div class="flex flex-col items-center gap-1.5">
            <button
              type="button"
              class="h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90"
              :class="calls.isMuted ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25 text-white'"
              @click="calls.toggleMute"
            >
              <svg v-if="!calls.isMuted" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/>
              </svg>
              <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M17 16.95A7 7 0 015 12v-2M12 19v4M8 23h8"/>
              </svg>
            </button>
            <span class="text-[10px] text-slate-300">{{ calls.isMuted ? 'Микро выкл' : 'Микрофон' }}</span>
          </div>

          <!-- Camera -->
          <div v-if="call.kind === 'video'" class="flex flex-col items-center gap-1.5">
            <button
              type="button"
              class="h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90"
              :class="calls.isCameraOff ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25 text-white'"
              @click="calls.toggleCamera"
            >
              <svg v-if="!calls.isCameraOff" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10l4.55-2.28A1 1 0 0121 8.73v6.54a1 1 0 01-1.45.9L15 14M3 8h12a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 011-1z"/>
              </svg>
              <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23" stroke-linecap="round"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21H3a1 1 0 01-1-1v-8m3.78-3.78A1 1 0 013 9V8m9 0h3l4.55-2.28A1 1 0 0121 8.73v6.54a1 1 0 01-1.45.9L15 14"/>
              </svg>
            </button>
            <span class="text-[10px] text-slate-300">{{ calls.isCameraOff ? 'Камера выкл' : 'Камера' }}</span>
          </div>

          <!-- Switch camera -->
          <div v-if="call.kind === 'video'" class="flex flex-col items-center gap-1.5">
            <button
              type="button"
              class="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all active:scale-90"
              @click="calls.switchCamera"
            >
              <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h5M20 20v-5h-5"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.49 9A9 9 0 005.64 5.64L4 7M3.51 15A9 9 0 0018.36 18.36L20 17"/>
              </svg>
            </button>
            <span class="text-[10px] text-slate-300">Flip</span>
          </div>

          <!-- Hangup -->
          <div class="flex flex-col items-center gap-1.5">
            <button
              type="button"
              class="h-16 w-16 rounded-full bg-red-600 hover:bg-red-500 active:scale-90 transition-all flex items-center justify-center shadow-2xl"
              @click="calls.hangup"
            >
              <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.5 11.5 0 003.6.57 1 1 0 011 1V21a1 1 0 01-1 1A17 17 0 013 5a1 1 0 011-1h3.5a1 1 0 011 1 11.5 11.5 0 00.57 3.6 1 1 0 01-.24 1.01l-2.21 2.18z"/>
                <line x1="4" y1="4" x2="20" y2="20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              </svg>
            </button>
            <span class="text-[10px] text-red-400 font-medium">Завершить</span>
          </div>

          <!-- Speaker -->
          <div class="flex flex-col items-center gap-1.5">
            <button
              type="button"
              class="h-14 w-14 rounded-full flex items-center justify-center transition-all active:scale-90"
              :class="speakerOn ? 'bg-white text-slate-900' : 'bg-white/15 hover:bg-white/25 text-white'"
              :disabled="!speakerSupported"
              :title="speakerOn ? 'Выключить громкую связь' : 'Громкая связь'"
              @click="toggleSpeaker"
            >
              <svg v-if="speakerOn" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <polygon stroke-linejoin="round" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path stroke-linecap="round" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
              <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <polygon stroke-linejoin="round" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15" stroke-linecap="round"/>
                <line x1="17" y1="9" x2="23" y2="15" stroke-linecap="round"/>
              </svg>
            </button>
            <span class="text-[10px] text-slate-300">{{ speakerOn ? 'Громко' : 'Динамик' }}</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Incoming file -->
    <Transition name="fade-up">
      <div v-if="incomingFile" class="fixed inset-0 z-[205] flex items-end justify-center pb-8 md:items-center md:pb-0 bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-sm mx-4 rounded-3xl bg-slate-900 border border-slate-700/50 p-6 shadow-2xl">
          <div class="flex items-start gap-3 mb-5">
            <div class="h-10 w-10 rounded-xl bg-sky-600/20 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <div class="font-semibold text-sm truncate">{{ incomingFile.originalName }}</div>
              <div class="text-xs text-slate-400 mt-0.5">От: {{ incomingFile.fromName }} · {{ calls.formatBytes(incomingFile.size) }}</div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2">
            <button type="button" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm" @click="calls.dismissIncomingFile">Закрыть</button>
            <button type="button" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-medium" :disabled="calls.isDownloading" @click="calls.downloadIncomingFile">
              {{ calls.isDownloading ? 'Скачиваем…' : 'Скачать' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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

const toggleSpeaker = async () => {
  if (!speakerSupported.value) return;
  speakerOn.value = !speakerOn.value;
  try {
    const el = remoteVideo.value as any;
    await el.setSinkId(speakerOn.value ? 'default' : '');
  } catch {
    speakerOn.value = false;
  }
};

const now = ref(Date.now());
let timerInterval: number | null = null;

const durationText = computed(() => {
  if (!call.value?.startedAt) return '00:00';
  const sec = Math.max(0, Math.floor((now.value - call.value.startedAt) / 1000));
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
});

watch(
  () => call.value?.state,
  (state) => {
    if (state === 'inCall') {
      timerInterval = window.setInterval(() => { now.value = Date.now(); }, 1000);
    } else {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    }
  }
);

const pipX = ref(typeof window !== 'undefined' ? window.innerWidth - 148 : 220);
const pipY = ref(typeof window !== 'undefined' ? window.innerHeight - 280 : 400);
let dragOffX = 0;
let dragOffY = 0;
let dragging = false;

const pipStyle = computed(() => ({
  left: `${pipX.value}px`,
  top: `${pipY.value}px`,
  width: '120px',
  height: '180px',
}));

const startDrag = (e: PointerEvent) => {
  dragging = true;
  dragOffX = e.clientX - pipX.value;
  dragOffY = e.clientY - pipY.value;
  window.addEventListener('pointermove', onDrag);
  window.addEventListener('pointerup', stopDrag);
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
};

const onDrag = (e: PointerEvent) => {
  if (!dragging) return;
  pipX.value = Math.max(0, Math.min(window.innerWidth - 120, e.clientX - dragOffX));
  pipY.value = Math.max(0, Math.min(window.innerHeight - 180, e.clientY - dragOffY));
};

const stopDrag = () => {
  dragging = false;
  window.removeEventListener('pointermove', onDrag);
  window.removeEventListener('pointerup', stopDrag);
};

const attachStreams = () => {
  if (remoteVideo.value) remoteVideo.value.srcObject = calls.remoteStream || null;
  if (localVideo.value) localVideo.value.srcObject = calls.localStream || null;
};

watch(() => [calls.localStream, calls.remoteStream, call.value?.callId], () => attachStreams());

const initials = (name: string) =>
  (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');

onMounted(async () => {
  await calls.init();
  attachStreams();
});

onBeforeUnmount(() => {
  if (timerInterval) clearInterval(timerInterval);
  stopDrag();
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.fade-up-enter-active, .fade-up-leave-active { transition: opacity .25s, transform .25s; }
.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateY(24px); }
</style>
