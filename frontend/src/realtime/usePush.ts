import axios from 'axios';

let subscribed = false;

export const initPush = async () => {
  if (subscribed) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const { data } = await axios.get('/api/v1/push/vapid-public-key');
    const vapidPublicKey: string = data?.publicKey || '';
    if (!vapidPublicKey) return;

    const reg = await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await sendSubscription(existing);
      subscribed = true;
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
    });

    await sendSubscription(sub);
    subscribed = true;
  } catch {
    // silently ignore — push is optional
  }
};

const sendSubscription = async (sub: PushSubscription) => {
  const json = sub.toJSON();
  await axios.post('/api/v1/push/subscribe', {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh || '', auth: json.keys?.auth || '' },
  });
};

const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
};
