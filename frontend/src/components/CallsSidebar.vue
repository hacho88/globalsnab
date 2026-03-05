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

    <div v-if="isOpen" class="px-3 pt-2 pb-3">
      <div class="flex items-center gap-2 mb-2">
        <input
          v-model="query"
          class="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs"
          placeholder="Поиск пользователя"
        />
      </div>

      <div class="flex items-center justify-between mb-2">
        <label class="flex items-center gap-2 text-xs text-slate-300">
          <input type="checkbox" v-model="preferMaxQuality" />
          Макс качество
        </label>
        <button
          class="text-xs text-slate-300 hover:text-white"
          type="button"
          @click="refreshUsers"
        >
          Обновить
        </button>
      </div>

      <div v-if="isLoading" class="text-xs text-slate-400">Загрузка...</div>
      <div v-else class="space-y-2 max-h-56 overflow-auto pr-1">
        <div
          v-for="u in filteredUsers"
          :key="u.id"
          class="flex items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <div class="text-xs truncate">{{ u.fullName }}</div>
            <div class="text-[10px] text-slate-400 truncate">{{ u.email }}</div>
          </div>
          <div class="flex items-center gap-1 flex-shrink-0">
            <button
              class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              type="button"
              :disabled="!canCall(u)"
              @click="startCall(u, 'audio')"
              title="Аудио"
            >
              🎧
            </button>
            <button
              class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px]"
              type="button"
              :disabled="!canCall(u)"
              @click="startCall(u, 'video')"
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

      <div v-if="error" class="text-xs text-red-300 mt-2">{{ error }}</div>
      <div v-if="fileStatus" class="text-xs text-slate-300 mt-2">{{ fileStatus }}</div>
    </div>

    <input
      ref="fileInput"
      class="hidden"
      type="file"
      @change="onFilePicked"
    />

    <div v-if="incoming" class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-md rounded bg-slate-950 border border-slate-700 p-4">
        <div class="text-sm font-semibold mb-1">Входящий звонок</div>
        <div class="text-xs text-slate-300 mb-3">
          {{ incoming.fromName }} ({{ incoming.kind === 'video' ? 'видео' : 'аудио' }})
        </div>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs"
            @click="rejectIncoming"
          >
            Отклонить
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs"
            @click="acceptIncoming"
          >
            Принять
          </button>
        </div>
      </div>
    </div>

    <div v-if="call" class="fixed inset-0 z-[101] bg-black/80">
      <div class="absolute inset-0 flex flex-col">
        <div class="p-3 flex items-center justify-between bg-slate-950/80 border-b border-slate-800">
          <div class="text-sm">
            {{ call.peerName }} — {{ call.kind === 'video' ? 'видео' : 'аудио' }}
            <span v-if="call.state === 'calling'" class="text-slate-400"> (звоним...)</span>
            <span v-if="call.state === 'connecting'" class="text-slate-400"> (соединение...)</span>
            <span v-if="call.state === 'inCall'" class="text-slate-400"> (в звонке)</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs"
              @click="toggleMute"
            >
              {{ isMuted ? 'Вкл звук' : 'Выкл звук' }}
            </button>
            <button
              v-if="call.kind === 'video'"
              type="button"
              class="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs"
              @click="toggleCamera"
            >
              {{ isCameraOff ? 'Вкл камеру' : 'Выкл камеру' }}
            </button>
            <button
              type="button"
              class="px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-xs"
              @click="hangup"
            >
              Завершить
            </button>
          </div>
        </div>

        <div class="flex-1 relative">
          <video
            ref="remoteVideo"
            class="absolute inset-0 w-full h-full object-contain"
            autoplay
            playsinline
          ></video>
          <video
            v-if="call.kind === 'video'"
            ref="localVideo"
            class="absolute bottom-3 right-3 w-40 h-28 bg-black rounded border border-slate-700 object-cover"
            autoplay
            muted
            playsinline
          ></video>
        </div>

        <div class="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between">
          <div class="text-xs text-slate-300">
            {{ statsText }}
          </div>
          <div class="text-xs text-slate-400">
            {{ qualityText }}
          </div>
        </div>
      </div>
    </div>

    <div v-if="incomingFile" class="fixed inset-0 z-[102] flex items-center justify-center bg-black/60 p-4">
      <div class="w-full max-w-md rounded bg-slate-950 border border-slate-700 p-4">
        <div class="text-sm font-semibold mb-1">Получен файл</div>
        <div class="text-xs text-slate-300 mb-1">От: {{ incomingFile.fromName }}</div>
        <div class="text-xs text-slate-300 mb-3">
          {{ incomingFile.originalName }} ({{ formatBytes(incomingFile.size) }})
        </div>
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-xs"
            @click="dismissIncomingFile"
          >
            Закрыть
          </button>
          <button
            type="button"
            class="px-3 py-2 rounded bg-sky-600 hover:bg-sky-500 text-xs"
            :disabled="isDownloading"
            @click="downloadIncomingFile"
          >
            {{ isDownloading ? 'Скачиваем...' : 'Скачать' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import axios from 'axios';
import { getSocket } from '../realtime/socket';

type CallKind = 'audio' | 'video';

type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager';
  isActive: boolean;
  isMe: boolean;
};

type IncomingCall = {
  callId: string;
  fromUserId: string;
  fromName: string;
  kind: CallKind;
};

type ActiveCall = {
  callId: string;
  peerUserId: string;
  peerName: string;
  kind: CallKind;
  state: 'calling' | 'connecting' | 'inCall';
  initiator: boolean;
};

type IncomingFile = {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const isOpen = ref(false);
const isLoading = ref(false);
const error = ref('');
const fileStatus = ref('');
const users = ref<UserRow[]>([]);
const query = ref('');
const preferMaxQuality = ref(false);

const incoming = ref<IncomingCall | null>(null);
const call = ref<ActiveCall | null>(null);

const localVideo = ref<HTMLVideoElement | null>(null);
const remoteVideo = ref<HTMLVideoElement | null>(null);

const fileInput = ref<HTMLInputElement | null>(null);
const fileTargetUser = ref<UserRow | null>(null);
const isUploading = ref(false);
const incomingFile = ref<IncomingFile | null>(null);
const isDownloading = ref(false);

const pc = ref<RTCPeerConnection | null>(null);
const localStream = ref<MediaStream | null>(null);
const remoteStream = ref<MediaStream | null>(null);

const isMuted = ref(false);
const isCameraOff = ref(false);

const lastStats = ref<{ bitrateKbps?: number; rttMs?: number; packetsLost?: number } | null>(null);
let statsTimer: number | null = null;

const filteredUsers = computed(() => {
  const q = query.value.trim().toLowerCase();
  const list = users.value.filter((u) => !u.isMe);
  if (!q) return list;
  return list.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
});

const canCall = (u: UserRow) => {
  return !call.value && !incoming.value && u.isActive && !u.isMe;
};

const canSendFile = (u: UserRow) => {
  return !isUploading.value && u.isActive && !u.isMe;
};

const formatBytes = (bytes: number) => {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const qualityText = computed(() => {
  if (!call.value) return '';
  return preferMaxQuality.value ? 'Качество: max' : 'Качество: HD';
});

const statsText = computed(() => {
  if (!call.value) return '';
  const s = lastStats.value;
  if (!s) return 'Статистика: —';
  const parts: string[] = [];
  if (typeof s.bitrateKbps === 'number') parts.push(`битрейт ~${Math.round(s.bitrateKbps)} kbps`);
  if (typeof s.rttMs === 'number') parts.push(`rtt ${Math.round(s.rttMs)} ms`);
  if (typeof s.packetsLost === 'number') parts.push(`loss ${s.packetsLost}`);
  return parts.length ? `Статистика: ${parts.join(' · ')}` : 'Статистика: —';
});

const refreshUsers = async () => {
  error.value = '';
  fileStatus.value = '';
  isLoading.value = true;
  try {
    const res = await axios.get('/api/v1/users');
    users.value = res.data.users;
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || 'Ошибка загрузки пользователей';
  } finally {
    isLoading.value = false;
  }
};

const selectFileForUser = (u: UserRow) => {
  error.value = '';
  fileStatus.value = '';
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
  if (file.size > 50 * 1024 * 1024) {
    error.value = 'Файл слишком большой (максимум 50MB)';
    return;
  }

  isUploading.value = true;
  try {
    fileStatus.value = `Отправка: ${file.name}`;
    const form = new FormData();
    form.append('toUserId', target.id);
    form.append('file', file);

    await axios.post('/api/v1/files/send', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    fileStatus.value = `Файл отправлен: ${target.fullName}`;
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || 'Ошибка отправки файла';
    fileStatus.value = '';
  } finally {
    isUploading.value = false;
  }
};

const dismissIncomingFile = () => {
  incomingFile.value = null;
};

const downloadIncomingFile = async () => {
  if (!incomingFile.value) return;
  isDownloading.value = true;
  try {
    const f = incomingFile.value;
    const res = await axios.get(`/api/v1/files/${f.id}/download`, { responseType: 'blob' });
    const blob = new Blob([res.data], { type: f.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = f.originalName || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    incomingFile.value = null;
  } catch (e: any) {
    error.value = e?.response?.data?.message || e?.message || 'Ошибка скачивания файла';
  } finally {
    isDownloading.value = false;
  }
};

const iceServers = computed<RTCIceServer[]>(() => {
  return [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      urls: ['turn:globalsnab.su:3478?transport=udp', 'turns:globalsnab.su:5349?transport=tcp'],
      username: 'globalsnabturn',
      credential: 'R8mVw7Kp2QxD9sF4nL1cT6yZ!aB3',
    },
  ];
});

const getMediaConstraints = (kind: CallKind): MediaStreamConstraints => {
  const wantVideo = kind === 'video';
  const video = !wantVideo
    ? false
    : preferMaxQuality.value
      ? {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: { ideal: 30, max: 60 },
        }
      : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        };

  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video,
  };
};

const createPeer = async (kind: CallKind) => {
  const peer = new RTCPeerConnection({ iceServers: iceServers.value });
  peer.onicecandidate = (ev) => {
    if (!ev.candidate || !call.value) return;
    sock.emit('webrtc:ice', { toUserId: call.value.peerUserId, callId: call.value.callId, candidate: ev.candidate });
  };

  peer.ontrack = (ev) => {
    if (!remoteStream.value) {
      remoteStream.value = new MediaStream();
    }
    remoteStream.value.addTrack(ev.track);
    if (remoteVideo.value) {
      remoteVideo.value.srcObject = remoteStream.value;
    }
  };

  const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(kind));
  localStream.value = stream;
  for (const track of stream.getTracks()) {
    peer.addTrack(track, stream);
  }
  if (localVideo.value) {
    localVideo.value.srcObject = stream;
  }

  pc.value = peer;

  startStats();
  return peer;
};

const startStats = () => {
  stopStats();
  const peer = pc.value;
  if (!peer) return;

  let lastBytes = 0;
  let lastTs = 0;

  statsTimer = window.setInterval(async () => {
    if (!pc.value) return;
    const stats = await pc.value.getStats();
    let rtt: number | undefined;
    let packetsLost: number | undefined;
    let bytesReceived: number | undefined;
    let timestamp: number | undefined;

    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && (report as any).state === 'succeeded' && (report as any).currentRoundTripTime) {
        rtt = (report as any).currentRoundTripTime * 1000;
      }
      if (report.type === 'inbound-rtp' && (report as any).kind === 'video') {
        packetsLost = (report as any).packetsLost;
        bytesReceived = (report as any).bytesReceived;
        timestamp = report.timestamp;
      }
    });

    let bitrateKbps: number | undefined;
    if (typeof bytesReceived === 'number' && typeof timestamp === 'number') {
      if (lastTs) {
        const dt = (timestamp - lastTs) / 1000;
        const db = bytesReceived - lastBytes;
        if (dt > 0) bitrateKbps = (db * 8) / 1000 / dt;
      }
      lastBytes = bytesReceived;
      lastTs = timestamp;
    }

    lastStats.value = { bitrateKbps, rttMs: rtt, packetsLost };
  }, 1500);
};

const stopStats = () => {
  if (statsTimer) {
    clearInterval(statsTimer);
    statsTimer = null;
  }
  lastStats.value = null;
};

const cleanupCall = () => {
  stopStats();

  if (pc.value) {
    pc.value.onicecandidate = null;
    pc.value.ontrack = null;
    pc.value.close();
    pc.value = null;
  }

  if (localStream.value) {
    for (const t of localStream.value.getTracks()) t.stop();
    localStream.value = null;
  }

  remoteStream.value = null;

  if (localVideo.value) localVideo.value.srcObject = null;
  if (remoteVideo.value) remoteVideo.value.srcObject = null;

  isMuted.value = false;
  isCameraOff.value = false;
};

const hangup = () => {
  if (call.value) {
    sock.emit('call:hangup', { toUserId: call.value.peerUserId, callId: call.value.callId });
  }
  call.value = null;
  cleanupCall();
};

const toggleMute = () => {
  if (!localStream.value) return;
  isMuted.value = !isMuted.value;
  localStream.value.getAudioTracks().forEach((t) => (t.enabled = !isMuted.value));
};

const toggleCamera = () => {
  if (!localStream.value) return;
  isCameraOff.value = !isCameraOff.value;
  localStream.value.getVideoTracks().forEach((t) => (t.enabled = !isCameraOff.value));
};

const makeCallId = () => {
  const anyCrypto = crypto as any;
  return typeof anyCrypto?.randomUUID === 'function' ? anyCrypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
};

const startCall = async (u: UserRow, kind: CallKind) => {
  if (call.value || incoming.value) return;
  const callId = makeCallId();

  call.value = {
    callId,
    peerUserId: u.id,
    peerName: u.fullName,
    kind,
    state: 'calling',
    initiator: true,
  };

  try {
    await createPeer(kind);
    sock.emit('call:invite', { toUserId: u.id, callId, kind });
  } catch (e: any) {
    error.value = e?.message || 'Не удалось получить доступ к микрофону/камере';
    call.value = null;
    cleanupCall();
  }
};

const acceptIncoming = async () => {
  if (!incoming.value) return;
  const inc = incoming.value;
  incoming.value = null;

  call.value = {
    callId: inc.callId,
    peerUserId: inc.fromUserId,
    peerName: inc.fromName,
    kind: inc.kind,
    state: 'connecting',
    initiator: false,
  };

  try {
    await createPeer(inc.kind);
    sock.emit('call:accept', { toUserId: inc.fromUserId, callId: inc.callId });
  } catch (e: any) {
    sock.emit('call:reject', { toUserId: inc.fromUserId, callId: inc.callId });
    error.value = e?.message || 'Не удалось получить доступ к микрофону/камере';
    call.value = null;
    cleanupCall();
  }
};

const rejectIncoming = () => {
  if (!incoming.value) return;
  const inc = incoming.value;
  incoming.value = null;
  sock.emit('call:reject', { toUserId: inc.fromUserId, callId: inc.callId });
};

const sock = getSocket();

const getUserName = (id: string) => {
  const u = users.value.find((x) => x.id === id);
  return u?.fullName || 'Пользователь';
};

sock.on('call:incoming', (data: { fromUserId: string; callId: string; kind: CallKind }) => {
  if (call.value || incoming.value) {
    sock.emit('call:reject', { toUserId: data.fromUserId, callId: data.callId });
    return;
  }
  incoming.value = {
    fromUserId: data.fromUserId,
    callId: data.callId,
    kind: data.kind,
    fromName: getUserName(data.fromUserId),
  };
});

sock.on('file:incoming', (data: IncomingFile) => {
  incomingFile.value = data;
  fileStatus.value = '';
});

sock.on('call:accepted', async (data: { fromUserId: string; callId: string }) => {
  if (!call.value || call.value.callId !== data.callId || !call.value.initiator) return;
  call.value.state = 'connecting';

  try {
    const peer = pc.value;
    if (!peer) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sock.emit('webrtc:offer', { toUserId: call.value.peerUserId, callId: call.value.callId, sdp: offer });
  } catch {
    hangup();
  }
});

sock.on('call:rejected', (data: { fromUserId: string; callId: string }) => {
  if (!call.value || call.value.callId !== data.callId) return;
  call.value = null;
  cleanupCall();
});

sock.on('call:hangup', (data: { fromUserId: string; callId: string }) => {
  if (!call.value || call.value.callId !== data.callId) return;
  call.value = null;
  cleanupCall();
});

sock.on('webrtc:offer', async (data: { fromUserId: string; callId: string; sdp: RTCSessionDescriptionInit }) => {
  if (!call.value || call.value.callId !== data.callId || call.value.initiator) return;
  const peer = pc.value;
  if (!peer) return;

  await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  sock.emit('webrtc:answer', { toUserId: call.value.peerUserId, callId: call.value.callId, sdp: answer });
  call.value.state = 'inCall';
});

sock.on('webrtc:answer', async (data: { fromUserId: string; callId: string; sdp: RTCSessionDescriptionInit }) => {
  if (!call.value || call.value.callId !== data.callId || !call.value.initiator) return;
  const peer = pc.value;
  if (!peer) return;

  await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
  call.value.state = 'inCall';
});

sock.on('webrtc:ice', async (data: { fromUserId: string; callId: string; candidate: RTCIceCandidateInit }) => {
  if (!call.value || call.value.callId !== data.callId) return;
  const peer = pc.value;
  if (!peer) return;

  try {
    if (data.candidate) await peer.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch {
    return;
  }
});

watch(
  () => isOpen.value,
  async (open) => {
    if (open && users.value.length === 0) {
      await refreshUsers();
    }
  }
);

onMounted(async () => {
  await refreshUsers();
});

onBeforeUnmount(() => {
  sock.removeAllListeners();
  hangup();
});
</script>
