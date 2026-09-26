// Web Push (VAPID) support for JK Message
// Delivers notifications to phones/desktops even when the app is closed,
// by sending push messages through the browser vendor's push service to our Service Worker (public/sw.js).
import fs from "fs";
import path from "path";
import crypto from "crypto";
import webpush from "web-push";
import {
  getFirestoreClient,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
} from "./serverFirestore";

export interface PushSubscriptionRecord {
  id: string; // sha256(endpoint)
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  mode?: "sound" | "vibrate" | "silent";
  data?: { url?: string; conversationId?: string };
}

const DATA_DIR = path.join(process.cwd(), "data");
const VAPID_FILE = path.join(DATA_DIR, "vapid.json");
const SUBS_FILE = path.join(DATA_DIR, "push-subscriptions.json");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@jkmessage.onrender.com";

let vapidPublicKey: string | null = null;
const subscriptions = new Map<string, PushSubscriptionRecord>();

function hashEndpoint(endpoint: string): string {
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

function saveLocalSubs() {
  try {
    fs.writeFileSync(SUBS_FILE, JSON.stringify(Array.from(subscriptions.values()), null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save push-subscriptions.json:", err);
  }
}

function readJsonFile<T>(file: string): T | null {
  try {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, "utf-8").trim();
      if (content) return JSON.parse(content) as T;
    }
  } catch (err) {
    console.warn(`Failed to read ${file}:`, err);
  }
  return null;
}

// VAPID keys must stay the same across restarts/redeploys, otherwise every existing
// subscription becomes invalid. Priority: env vars -> Firestore -> local file -> generate new.
async function loadVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }

  const firestore = getFirestoreClient();
  if (firestore) {
    try {
      const snap = await getDoc(doc(firestore, "config", "vapid"));
      const data = snap.exists() ? (snap.data() as any) : null;
      if (data?.publicKey && data?.privateKey) {
        return { publicKey: data.publicKey, privateKey: data.privateKey };
      }
    } catch (err) {
      console.warn("⚠️ Failed to read VAPID keys from Firestore:", err);
    }
  }

  const local = readJsonFile<{ publicKey: string; privateKey: string }>(VAPID_FILE);
  const keys = local?.publicKey && local?.privateKey ? local : webpush.generateVAPIDKeys();
  if (!local) {
    console.log("🔑 Generated new VAPID keys for Web Push.");
  }

  try {
    fs.writeFileSync(VAPID_FILE, JSON.stringify(keys, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save vapid.json:", err);
  }
  if (firestore) {
    try {
      await setDoc(doc(firestore, "config", "vapid"), { ...keys, createdAt: Date.now() });
    } catch (err) {
      console.warn("⚠️ Failed to persist VAPID keys to Firestore:", err);
    }
  }
  return keys;
}

async function loadSubscriptions() {
  const local = readJsonFile<PushSubscriptionRecord[]>(SUBS_FILE);
  if (Array.isArray(local)) {
    for (const s of local) subscriptions.set(s.id, s);
  }

  const firestore = getFirestoreClient();
  if (!firestore) return;
  try {
    const snap = await getDocs(collection(firestore, "pushSubscriptions"));
    for (const d of snap.docs) {
      const s = d.data() as PushSubscriptionRecord;
      if (s?.id && s.endpoint && s.keys) subscriptions.set(s.id, s);
    }
    saveLocalSubs();
  } catch (err) {
    console.warn("⚠️ Failed to load push subscriptions from Firestore:", err);
  }
}

export async function initPush() {
  try {
    const keys = await loadVapidKeys();
    webpush.setVapidDetails(VAPID_SUBJECT, keys.publicKey, keys.privateKey);
    vapidPublicKey = keys.publicKey;
    await loadSubscriptions();
    console.log(`🔔 Web Push ready (${subscriptions.size} subscriptions).`);
  } catch (err) {
    console.error("❌ Web Push init failed, background notifications disabled:", err);
  }
}

export function getVapidPublicKey(): string | null {
  return vapidPublicKey;
}

export function addSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
): PushSubscriptionRecord {
  const id = hashEndpoint(sub.endpoint);
  const now = Date.now();
  const record: PushSubscriptionRecord = {
    id,
    userId,
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    userAgent: userAgent?.slice(0, 300),
    createdAt: subscriptions.get(id)?.createdAt || now,
    updatedAt: now,
  };
  subscriptions.set(id, record);
  saveLocalSubs();

  const firestore = getFirestoreClient();
  if (firestore) {
    setDoc(doc(firestore, "pushSubscriptions", id), record).catch((e) =>
      console.warn("Firestore push subscription save error:", e)
    );
  }
  return record;
}

export function getSubscriptionUserId(endpoint: string): string | undefined {
  return subscriptions.get(hashEndpoint(endpoint))?.userId;
}

export function removeSubscription(endpoint: string) {
  const id = hashEndpoint(endpoint);
  if (!subscriptions.delete(id)) return;
  saveLocalSubs();

  const firestore = getFirestoreClient();
  if (firestore) {
    deleteDoc(doc(firestore, "pushSubscriptions", id)).catch((e) =>
      console.warn("Firestore push subscription delete error:", e)
    );
  }
}

export function getUserSubscriptionCount(userId: string): number {
  let count = 0;
  for (const s of subscriptions.values()) if (s.userId === userId) count++;
  return count;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  errors: string[];
}

export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
  options: { skipEndpoint?: (endpoint: string) => boolean; onlyEndpoint?: string } = {}
): Promise<PushSendResult> {
  const result: PushSendResult = { sent: 0, failed: 0, errors: [] };
  if (!vapidPublicKey) {
    result.errors.push("VAPID keys not initialized");
    return result;
  }
  const targets = Array.from(subscriptions.values()).filter(
    (s) =>
      s.userId === userId &&
      (!options.onlyEndpoint || s.endpoint === options.onlyEndpoint) &&
      !options.skipEndpoint?.(s.endpoint)
  );
  if (targets.length === 0) return result;

  const body = JSON.stringify(payload);
  await Promise.all(
    targets.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          body,
          { TTL: 60 * 60 * 24, urgency: "high" }
        );
        result.sent++;
      } catch (err: any) {
        result.failed++;
        const status = err?.statusCode || "?";
        result.errors.push(`${status} ${String(err?.body || err?.message || err).slice(0, 200)}`);
        // 404/410: subscription expired or the user revoked permission -> forget it
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          removeSubscription(s.endpoint);
        } else {
          console.warn(`Web Push send failed (${status}):`, err?.body || err?.message || err);
        }
      }
    })
  );
  return result;
}
