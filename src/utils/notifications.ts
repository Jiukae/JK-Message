// Browser & Mobile ServiceWorker Notification utility for JK Message
import { sounds } from './audio';
import { NotificationMode } from '../types';

let swRegistration: ServiceWorkerRegistration | null = null;
let pushUserId: string | null = null;
let pushActive = false;

// True once this device is registered for background Web Push
export function isPushActive(): boolean {
  return pushActive;
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && ('Notification' in window || 'serviceWorker' in navigator);
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function initServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    await navigator.serviceWorker.ready;
    return reg;
  } catch (error) {
    console.warn('ServiceWorker init error:', error);
    return null;
  }
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Register this device for Web Push so the server can deliver notifications
 * while the app is closed or the phone is locked.
 * Safe to call repeatedly (e.g. on every login / app start).
 */
export async function syncPushSubscription(userId?: string | null): Promise<boolean> {
  if (userId !== undefined) pushUserId = userId;
  if (!pushUserId || !isPushSupported()) return false;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;

  try {
    const reg = swRegistration || (await initServiceWorker());
    if (!reg) return false;

    const keyRes = await fetch('/api/push/public-key');
    if (!keyRes.ok) return false;
    const { publicKey } = await keyRes.json();
    const applicationServerKey = urlBase64ToUint8Array(publicKey);

    let subscription = await reg.pushManager.getSubscription();

    // Server VAPID key changed -> the old subscription can no longer be used
    if (subscription) {
      const currentKey = subscription.options?.applicationServerKey;
      if (currentKey) {
        const a = new Uint8Array(currentKey);
        const same = a.length === applicationServerKey.length && a.every((v, i) => v === applicationServerKey[i]);
        if (!same) {
          await subscription.unsubscribe().catch(() => {});
          subscription = null;
        }
      }
    }

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });
    }

    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: pushUserId, subscription: subscription.toJSON() }),
    });
    pushActive = res.ok;
    return res.ok;
  } catch (error) {
    console.warn('Push subscription failed:', error);
    return false;
  }
}

/**
 * Stop background notifications for this device (called on logout).
 */
export async function removePushSubscription(): Promise<void> {
  pushUserId = null;
  pushActive = false;
  if (!isPushSupported()) return;
  try {
    const reg = swRegistration || (await navigator.serviceWorker.getRegistration('/'));
    const subscription = await reg?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => {});
    await subscription.unsubscribe().catch(() => {});
  } catch (error) {
    console.warn('Push unsubscribe failed:', error);
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) {
    console.warn('Browser does not support notifications');
    return 'unsupported';
  }

  // Unlock audio context on this user interaction
  sounds.unlockAudio();

  try {
    // Also ensure ServiceWorker is registered
    await initServiceWorker();

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      sounds.playIncomingMessage();
      // Register for background (app closed) push notifications
      syncPushSubscription();
    }

    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }
}

export interface NotificationPayloadOptions {
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  conversationId?: string;
  vibrate?: number[];
  forceMode?: NotificationMode;
  onClick?: () => void;
}

export async function sendBrowserNotification(
  title: string,
  options: NotificationPayloadOptions
): Promise<Notification | null> {
  const mode: NotificationMode = options.forceMode || sounds.getNotificationMode();

  // Trigger audio/haptic based strictly on mode:
  // - sound: plays chime + haptic
  // - vibrate: only haptic, no sound!
  // - silent: no sound, no haptic!
  sounds.playIncomingMessage(mode);

  if (typeof window === 'undefined') return null;

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return null;
  }

  const defaultIcon = '/icons/icon-192.svg';
  const defaultBadge = '/icons/icon-192.svg';
  const isSilentMode = mode === 'silent';
  const isVibrateOnly = mode === 'vibrate';
  const vibratePattern = isSilentMode ? [] : (options.vibrate || [200, 100, 200, 100, 200]);

  // 1. Mobile Priority: ServiceWorkerRegistration.showNotification()
  if ('serviceWorker' in navigator) {
    try {
      let reg = swRegistration;
      if (!reg) {
        reg = await navigator.serviceWorker.ready.catch(() => null);
      }
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          body: options.body,
          icon: options.icon || defaultIcon,
          badge: options.badge || defaultBadge,
          vibrate: vibratePattern,
          silent: isSilentMode || isVibrateOnly,
          tag: options.tag || `jk-msg-${Date.now()}`,
          renotify: true,
          data: {
            url: options.url || window.location.href,
            conversationId: options.conversationId,
          },
        } as any);
        return null;
      }
    } catch (swErr) {
      console.warn('SW showNotification failed, trying window.Notification:', swErr);
    }
  }

  // 2. Desktop Fallback: new Notification(...)
  try {
    const notification = new Notification(title, {
      body: options.body,
      icon: options.icon || defaultIcon,
      badge: options.badge || defaultBadge,
      silent: isSilentMode || isVibrateOnly,
    });

    notification.onclick = () => {
      window.focus();
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    setTimeout(() => {
      try {
        notification.close();
      } catch {}
    }, 6000);

    return notification;
  } catch (error) {
    console.warn('Desktop window.Notification construct failed:', error);
    return null;
  }
}

/**
 * Send a quick test notification to verify mobile popups & audio
 */
export async function sendTestNotification(mode?: NotificationMode): Promise<boolean> {
  const perm = await requestNotificationPermission();
  const effectiveMode = mode || sounds.getNotificationMode();
  
  const modeText =
    effectiveMode === 'sound'
      ? '소리 모드 (띠링~ 소리 + 진동)'
      : effectiveMode === 'vibrate'
      ? '진동 모드 (징~ 진동만)'
      : '무음 모드 (화면 알림만)';

  await sendBrowserNotification('🔔 JK Message 알림 테스트', {
    body: `현재 ${modeText}로 설정되어 있습니다.`,
    forceMode: effectiveMode,
  });
  return perm === 'granted';
}
