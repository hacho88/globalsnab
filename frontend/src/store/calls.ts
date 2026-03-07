import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import { getSocket } from '../realtime/socket';

export type CallKind = 'audio' | 'video';

export type UserRow = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'manager';
  isActive: boolean;
  isMe: boolean;
};

export type IncomingCall = {
  callId: string;
  fromUserId: string;
  fromName: string;
  kind: CallKind;
};

export type ActiveCall = {
  callId: string;
  peerUserId: string;
  peerName: string;
  kind: CallKind;
  state: 'calling' | 'connecting' | 'inCall';
  initiator: boolean;
  startedAt?: number;
};

export type IncomingFile = {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const makeId = () => {
  const anyCrypto = (globalThis as any)?.crypto as any;
  return typeof anyCrypto?.randomUUID === 'function'
    ? anyCrypto.randomUUID()
    : String(Date.now()) + '-' + Math.random().toString(16).slice(2);
};

export const useCallsStore = defineStore('calls', () => {
  const isOpen = ref(false);
  const isLoading = ref(false);
  const error = ref('');
  const fileStatus = ref('');

  const users = ref<UserRow[]>([]);
  const query = ref('');
  const preferMaxQuality = ref(true);
  const preferUltraQuality = ref(true);

  const onlineUserIds = ref<Set<string>>(new Set());
  const lastSeen = ref<Record<string, number>>({});

  const incoming = ref<IncomingCall | null>(null);
  const call = ref<ActiveCall | null>(null);

  const incomingFile = ref<IncomingFile | null>(null);
  const isUploading = ref(false);
  const isDownloading = ref(false);

  const pc = ref<RTCPeerConnection | null>(null);
  const localStream = ref<MediaStream | null>(null);
  const remoteStream = ref<MediaStream | null>(null);

  const isMuted = ref(false);
  const isCameraOff = ref(false);

  const ringtonePreset = ref<'classic' | 'soft' | 'digital'>(
    (localStorage.getItem('ringtonePreset') as any) || 'classic'
  );
  const ringtoneVolume = ref<number>(Number(localStorage.getItem('ringtoneVolume') || '0.35'));

  watch(ringtonePreset, (v) => {
    localStorage.setItem('ringtonePreset', v);
  });

  watch(ringtoneVolume, (v) => {
    localStorage.setItem('ringtoneVolume', String(v));
  });

  const setRingtonePreset = (v: 'classic' | 'soft' | 'digital') => {
    ringtonePreset.value = v;
  };

  const setRingtoneVolume = (v: number) => {
    ringtoneVolume.value = Math.min(1, Math.max(0, Number(v) || 0));
  };

  const lastStats = ref<{ bitrateKbps?: number; rttMs?: number; packetsLost?: number } | null>(null);
  let statsTimer: number | null = null;

  let ringCtx: AudioContext | null = null;
  let ringOsc: OscillatorNode | null = null;
  let ringGain: GainNode | null = null;

  const sock = getSocket();
  let swBound = false;

  const filteredUsers = computed(() => {
    const q = query.value.trim().toLowerCase();
    const list = users.value.filter((u) => !u.isMe);
    if (!q) return list;
    return list.filter((u) => u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  });

  const isOnline = (userId: string): boolean => {
    return onlineUserIds.value.has(userId);
  };

  const applySenderQuality = async (kind: CallKind) => {
    if (!pc.value) return;
    const senders = pc.value.getSenders();

    const videoMaxBps = preferUltraQuality.value ? 12_000_000 : preferMaxQuality.value ? 3_500_000 : 1_800_000;
    const audioMaxBps = preferUltraQuality.value ? 128_000 : preferMaxQuality.value ? 96_000 : 64_000;

    for (const s of senders) {
      if (!s.track) continue;
      try {
        const p = s.getParameters();
        p.encodings = p.encodings && p.encodings.length ? p.encodings : [{}];

        if (s.track.kind === 'video' && kind === 'video') {
          (p.encodings[0] as any).maxBitrate = videoMaxBps;
          (p as any).degradationPreference = 'maintain-framerate';
        }
        if (s.track.kind === 'audio') {
          (p.encodings[0] as any).maxBitrate = audioMaxBps;
        }
        await s.setParameters(p);
      } catch {
        // some browsers may reject setParameters — ignore
      }
    }
  };

  const getLastSeenTs = (userId: string): number | null => {
    return typeof lastSeen.value[userId] === 'number' ? lastSeen.value[userId] : null;
  };

  const formatLastSeen = (ts: number | null): string => {
    if (!ts) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diffSec < 60) return 'только что';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} ч назад`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay} д назад`;
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

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const getUserName = (id: string) => {
    const u = users.value.find((x) => x.id === id);
    return u?.fullName || 'Пользователь';
  };

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
    const video =
      !wantVideo
        ? false
        : preferUltraQuality.value
          ? {
              width: { ideal: 7680 },
              height: { ideal: 4320 },
              frameRate: { ideal: 30, max: 30 },
            }
          : preferMaxQuality.value
            ? {
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30, max: 60 },
              }
            : {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30, max: 30 },
              };

    return {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video,
    };
  };

  const startRinging = async () => {
    try {
      if (ringCtx) return;
      ringCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringGain = ringCtx.createGain();
      ringGain.gain.value = 0;
      ringGain.connect(ringCtx.destination);

      // Two-tone ringtone presets (WhatsApp/Telegram-style), no external assets.
      const oscA = ringCtx.createOscillator();
      const oscB = ringCtx.createOscillator();
      oscA.type = ringtonePreset.value === 'soft' ? 'triangle' : 'sine';
      oscB.type = ringtonePreset.value === 'digital' ? 'square' : 'sine';
      oscA.connect(ringGain);
      oscB.connect(ringGain);
      oscA.start();
      oscB.start();
      ringOsc = oscA;
      (ringGain as any)._ringOscB = oscB;

      const volume = Math.min(1, Math.max(0, ringtoneVolume.value || 0));

      const applyPreset = () => {
        if (!ringCtx || !ringGain) return;
        const t = ringCtx.currentTime;
        // Envelope: short attack/release to avoid clicks.
        const on = (dur: number) => {
          ringGain!.gain.cancelScheduledValues(t);
          ringGain!.gain.setValueAtTime(0, t);
          ringGain!.gain.linearRampToValueAtTime(volume, t + 0.02);
          ringGain!.gain.setTargetAtTime(0, t + dur, 0.03);
        };

        if (ringtonePreset.value === 'classic') {
          // “ti-ti ... ti-ti”
          oscA.frequency.setValueAtTime(440, t);
          oscB.frequency.setValueAtTime(494, t);
          on(0.18);
        } else if (ringtonePreset.value === 'soft') {
          // “doo ... doo”
          oscA.frequency.setValueAtTime(523.25, t);
          oscB.frequency.setValueAtTime(659.25, t);
          on(0.28);
        } else {
          // “beep-beep” digital
          oscA.frequency.setValueAtTime(784, t);
          oscB.frequency.setValueAtTime(988, t);
          on(0.12);
        }
      };

      applyPreset();
      const id = window.setInterval(applyPreset, ringtonePreset.value === 'soft' ? 900 : 650);
      (ringGain as any)._ringIntervalId = id;
    } catch {
      return;
    }
  };

  const stopRinging = () => {
    try {
      if (ringGain && (ringGain as any)._ringIntervalId) {
        clearInterval((ringGain as any)._ringIntervalId);
      }
      ringOsc?.stop();
      ringOsc?.disconnect();
      if (ringGain && (ringGain as any)._ringOscB) {
        try {
          (ringGain as any)._ringOscB.stop();
          (ringGain as any)._ringOscB.disconnect();
        } catch {
          // ignore
        }
      }
      ringGain?.disconnect();
      ringCtx?.close();
    } catch {
      return;
    } finally {
      ringCtx = null;
      ringOsc = null;
      ringGain = null;
    }
  };

  const startStats = () => {
    stopStats();
    if (!pc.value) return;

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
        if (
          report.type === 'candidate-pair' &&
          (report as any).state === 'succeeded' &&
          (report as any).currentRoundTripTime
        ) {
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
    stopRinging();
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
    isMuted.value = false;
    isCameraOff.value = false;
  };

  const createPeer = async (kind: CallKind) => {
    const peer = new RTCPeerConnection({ iceServers: iceServers.value });

    peer.onicecandidate = (ev) => {
      if (!ev.candidate || !call.value) return;
      sock.emit('webrtc:ice', {
        toUserId: call.value.peerUserId,
        callId: call.value.callId,
        candidate: ev.candidate,
      });
    };

    peer.ontrack = (ev) => {
      if (!remoteStream.value) {
        remoteStream.value = new MediaStream();
      }
      remoteStream.value.addTrack(ev.track);
    };

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(kind));
    } catch (e) {
      if (preferUltraQuality.value && kind === 'video') {
        preferUltraQuality.value = false;
        stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints(kind));
      } else {
        throw e;
      }
    }
    localStream.value = stream;
    for (const track of stream.getTracks()) {
      peer.addTrack(track, stream);
    }

    pc.value = peer;
    startStats();
    await applySenderQuality(kind);
    return peer;
  };

  const hangup = () => {
    if (call.value) {
      sock.emit('call:hangup', { toUserId: call.value.peerUserId, callId: call.value.callId });
    }
    call.value = null;
    incoming.value = null;
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

  const facingMode = ref<'user' | 'environment'>('user');

  const switchCamera = async () => {
    if (!call.value || call.value.kind !== 'video' || !pc.value) return;
    const nextFacing = facingMode.value === 'user' ? 'environment' : 'user';
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { exact: nextFacing } },
      });
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      const sender = pc.value.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newVideoTrack);

      if (localStream.value) {
        localStream.value.getVideoTracks().forEach((t) => {
          t.stop();
          localStream.value!.removeTrack(t);
        });
        localStream.value.addTrack(newVideoTrack);
      } else {
        localStream.value = new MediaStream([newVideoTrack]);
      }
      facingMode.value = nextFacing;
    } catch {
      // device may not support exact facingMode — ignore silently
    }
  };

  const startCall = async (u: UserRow, kind: CallKind) => {
    if (call.value || incoming.value) return;
    const callId = makeId();

    call.value = {
      callId,
      peerUserId: u.id,
      peerName: u.fullName,
      kind,
      state: 'calling',
      initiator: true,
    };

    try {
      sock.emit('call:invite', { toUserId: u.id, callId, kind });
      await createPeer(kind);
    } catch (e: any) {
      try {
        sock.emit('call:hangup', { toUserId: u.id, callId });
      } catch {
        // ignore
      }
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
    stopRinging();
    sock.emit('call:reject', { toUserId: inc.fromUserId, callId: inc.callId });
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

  const sendFile = async (toUserId: string, file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      error.value = 'Файл слишком большой (максимум 50MB)';
      return;
    }

    isUploading.value = true;
    error.value = '';
    try {
      fileStatus.value = `Отправка: ${file.name}`;
      const form = new FormData();
      form.append('toUserId', toUserId);
      form.append('file', file);
      await axios.post('/api/v1/files/send', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const user = users.value.find((u) => u.id === toUserId);
      fileStatus.value = user ? `Файл отправлен: ${user.fullName}` : 'Файл отправлен';
    } catch (e: any) {
      error.value = e?.response?.data?.message || e?.message || 'Ошибка отправки файла';
      fileStatus.value = '';
    } finally {
      isUploading.value = false;
    }
  };

  const bindSocketEvents = () => {
    sock.off('call:incoming');
    sock.off('call:accepted');
    sock.off('call:rejected');
    sock.off('call:hangup');
    sock.off('webrtc:offer');
    sock.off('webrtc:answer');
    sock.off('webrtc:ice');
    sock.off('file:incoming');
    sock.off('presence:snapshot');
    sock.off('presence:update');

    sock.on('presence:snapshot', (data: { onlineUserIds: string[]; lastSeen: Record<string, number> }) => {
      onlineUserIds.value = new Set(data.onlineUserIds || []);
      lastSeen.value = data.lastSeen || {};
    });

    sock.on('presence:update', (data: { userId: string; online: boolean; lastSeen?: number }) => {
      if (!data?.userId) return;
      if (data.online) {
        onlineUserIds.value.add(data.userId);
        const copy = { ...lastSeen.value };
        delete copy[data.userId];
        lastSeen.value = copy;
      } else {
        onlineUserIds.value.delete(data.userId);
        if (typeof data.lastSeen === 'number') {
          lastSeen.value = { ...lastSeen.value, [data.userId]: data.lastSeen };
        }
      }
    });

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
      startRinging();
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
      call.value.startedAt = Date.now();
    });

    sock.on('webrtc:answer', async (data: { fromUserId: string; callId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!call.value || call.value.callId !== data.callId || !call.value.initiator) return;
      const peer = pc.value;
      if (!peer) return;

      await peer.setRemoteDescription(new RTCSessionDescription(data.sdp));
      call.value.state = 'inCall';
      call.value.startedAt = Date.now();
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
  };

  const init = async () => {
    bindSocketEvents();
    if (!swBound && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      swBound = true;
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        const data: any = event.data;
        if (data?.type !== 'call:incoming') return;
        if (!data?.fromUserId || !data?.callId) return;
        if (call.value || incoming.value) return;

        incoming.value = {
          fromUserId: String(data.fromUserId),
          callId: String(data.callId),
          kind: (data.kind as CallKind) || 'audio',
          fromName: getUserName(String(data.fromUserId)),
        };

        startRinging();
      });
    }
    if (!users.value.length) {
      await refreshUsers();
    }
  };

  return {
    isOpen,
    isLoading,
    error,
    fileStatus,
    users,
    query,
    preferMaxQuality,
    preferUltraQuality,
    onlineUserIds,
    lastSeen,
    isOnline,
    getLastSeenTs,
    formatLastSeen,
    refreshUsers,
    incoming,
    call,
    incomingFile,
    isUploading,
    isDownloading,
    filteredUsers,
    qualityText,
    statsText,
    localStream,
    remoteStream,
    isMuted,
    isCameraOff,
    ringtonePreset,
    ringtoneVolume,
    setRingtonePreset,
    setRingtoneVolume,
    facingMode,
    startCall,
    acceptIncoming,
    rejectIncoming,
    hangup,
    toggleMute,
    toggleCamera,
    switchCamera,
    sendFile,
    dismissIncomingFile,
    downloadIncomingFile,
    init,
  };
});
