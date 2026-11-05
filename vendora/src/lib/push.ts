import webpush from "web-push";
import { db } from "./db";

let configured = false;

export function pushEnabled() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured || !pushEnabled()) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@localhost", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  configured = true;
}

/** Notificación push a todos los dispositivos de los usuarios indicados (app instalable del vendedor). */
export async function pushToUsers(userIds: string[], payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushEnabled() || userIds.length === 0) return 0;
  configure();
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => undefined);
      }
    }),
  );
  return sent;
}
