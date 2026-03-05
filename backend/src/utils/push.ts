import webpush from 'web-push';
import { env } from '../config/env';
import { PushSubscriptionModel } from '../models/PushSubscription';

let initialized = false;

const init = () => {
  if (initialized) return;
  if (!env.vapidPublicKey || !env.vapidPrivateKey) return;
  webpush.setVapidDetails(env.vapidEmail, env.vapidPublicKey, env.vapidPrivateKey);
  initialized = true;
};

export const sendPushToUser = async (
  userId: string,
  payload: { title: string; body: string; tag?: string; url?: string; [k: string]: any }
) => {
  init();
  if (!initialized) return;

  const subs = await PushSubscriptionModel.find({ userId }).lean();
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await PushSubscriptionModel.deleteOne({ _id: sub._id });
      }
    }
  }
};
