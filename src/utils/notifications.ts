// Browser & Mobile ServiceWorker Notification utility for JK Message
import { sounds } from './audio';
import { NotificationMode } from '../types';

let swRegistration: ServiceWorkerRegistration | null = null;

/**
 * Check if running inside the native Android APK wrapper
 */
export function isNativeAndroidApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).JKAndroidBridge ||
    (window as any).AndroidBridge ||
    (window as any).Android
  );
}

/**
 * Retrieve native Android JavaScript interface
 */
export function getAndroidBridge(): any {
  if (typeof window === 'undefined') return null;
  return (
    (window as any).JKAndroidBridge ||
    (window as any).AndroidBridge ||
    (window as any).Android ||
    null
  );
}

export function isNotificationSupported(): boolean {
  if (isNativeAndroidApp()) return true;
  return typeof window !== 'undefined' && ('Notification' in window || 'serviceWorker' in navigator);
}

/**
 * Detect iOS / iPadOS devices
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return isAppleTouch || isIPadOS;
}

/**
 * Check if the web app is running as an installed standalone PWA (Home Screen app)
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  const isStandaloneMatch = window.matchMedia?.('(display-mode: standalone)')?.matches;
  const isNavigatorStandalone = (navigator as any).standalone === true;
  return Boolean(isStandaloneMatch || isNavigatorStandalone);
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (isNativeAndroidApp()) return 'granted';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
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

export async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return null;
    const data = await res.json();
    return data.publicKey || null;
  } catch (e) {
    console.warn('Failed to fetch VAPID key:', e);
    return null;
  }
}

/**
 * Check if the browser currently has an active PushSubscription
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.pushManager) return false;
    const sub = await reg.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}

/**
 * Register mobile/browser device with Web Push so notifications arrive even when browser is closed
 */
export async function subscribeUserToPush(userId: string): Promise<boolean> {
  if (!userId || typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const reg = await initServiceWorker();
    if (!reg) return false;

    // Check permission
    if (Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
    }

    if (!reg.pushManager) {
      console.warn('PushManager not available on this browser');
      return false;
    }

    const publicKey = await getVapidPublicKey();
    if (!publicKey) {
      console.warn('No VAPID public key available from server');
      return false;
    }

    let sub = await reg.pushManager.getSubscription();

    // If subscription doesn't exist or is invalid, create new one
    if (!sub) {
      const convertedKey = urlBase64ToUint8Array(publicKey);
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }

    if (sub) {
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          subscription: sub.toJSON(),
        }),
      });
      return true;
    }
    return false;
  } catch (err) {
    console.error('Failed to subscribe user to Web Push:', err);
    return false;
  }
}

/**
 * Request notification permission and auto-subscribe to background push if userId is provided
 */
export async function requestNotificationPermission(userId?: string): Promise<NotificationPermission | 'unsupported'> {
  // If running in Native Android APK, permissions are handled by Android OS
  if (isNativeAndroidApp()) {
    return 'granted';
  }

  if (!isNotificationSupported()) {
    console.warn('Browser does not support notifications');
    return 'unsupported';
  }

  // Unlock audio context on this user interaction
  sounds.unlockAudio();

  try {
    await initServiceWorker();

    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    if (permission === 'granted') {
      sounds.playIncomingMessage();
      if (userId) {
        subscribeUserToPush(userId).catch(() => {});
      }
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

/**
 * Display a real system/OS notification immediately on Android / Desktop
 */
export async function showImmediateSystemNotification(
  title: string,
  options: NotificationPayloadOptions
): Promise<boolean> {
  const mode: NotificationMode = options.forceMode || sounds.getNotificationMode();
  sounds.unlockAudio();
  sounds.playIncomingMessage(mode);

  // 1. If running inside Native Android APK, use the high-priority AndroidBridge
  if (isNativeAndroidApp()) {
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.showNotification === 'function') {
      try {
        bridge.showNotification(title, options.body || '', options.conversationId || '');
        if (typeof bridge.vibrate === 'function' && mode !== 'silent') {
          bridge.vibrate(250);
        }
        return true;
      } catch (bridgeErr) {
        console.warn('Native AndroidBridge showNotification error:', bridgeErr);
      }
    }
  }

  if (typeof window === 'undefined') return false;

  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
  }

  const defaultIcon = '/icons/icon-192.png';
  const defaultBadge = '/icons/badge-96.png';
  const isSilentMode = mode === 'silent';
  const isVibrateOnly = mode === 'vibrate';
  const vibratePattern = isSilentMode ? [] : (options.vibrate || [250, 100, 250, 100, 250]);

  try {
    const reg = await navigator.serviceWorker.ready;
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
      return true;
    }
  } catch (swErr) {
    console.warn('SW showNotification error:', swErr);
  }

  // Desktop fallback
  try {
    const isMobileDevice = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
    if (!isMobileDevice && typeof Notification !== 'undefined') {
      new Notification(title, {
        body: options.body,
        icon: defaultIcon,
        badge: defaultBadge,
        silent: isSilentMode || isVibrateOnly,
      });
      return true;
    }
  } catch {}

  return false;
}

/**
 * Trigger delayed server-sent Web Push (so user can minimize browser/lock phone and test real arrival)
 */
export async function triggerDelayedPushTest(
  userId: string,
  delaySeconds: number = 3
): Promise<{ success: boolean; message: string }> {
  try {
    // Ensure subscribed first
    await subscribeUserToPush(userId);

    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, delaySeconds }),
    });
    const data = await res.json();
    return {
      success: Boolean(data.success),
      message: data.message || '알림 요청 완료',
    };
  } catch (e: any) {
    return {
      success: false,
      message: e?.message || '푸시 요청 실패',
    };
  }
}

export async function sendBrowserNotification(
  title: string,
  options: NotificationPayloadOptions
): Promise<Notification | null> {
  const mode: NotificationMode = options.forceMode || sounds.getNotificationMode();

  sounds.playIncomingMessage(mode);

  // 1. If running inside Native Android APK, use the high-priority AndroidBridge
  if (isNativeAndroidApp()) {
    const bridge = getAndroidBridge();
    if (bridge && typeof bridge.showNotification === 'function') {
      try {
        bridge.showNotification(title, options.body || '', options.conversationId || '');
        if (typeof bridge.vibrate === 'function' && mode !== 'silent') {
          bridge.vibrate(250);
        }
        return null;
      } catch (bridgeErr) {
        console.warn('Native AndroidBridge sendNotification error:', bridgeErr);
      }
    }
  }

  if (typeof window === 'undefined') return null;

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return null;
  }

  const defaultIcon = '/icons/icon-192.png';
  const defaultBadge = '/icons/badge-96.png';
  const isSilentMode = mode === 'silent';
  const isVibrateOnly = mode === 'vibrate';
  const vibratePattern = isSilentMode ? [] : (options.vibrate || [250, 100, 250, 100, 250]);

  // 1. Mobile Priority: ServiceWorkerRegistration.showNotification()
  if ('serviceWorker' in navigator) {
    try {
      let reg = swRegistration;
      if (!reg || !reg.active) {
        reg = await navigator.serviceWorker.getRegistration();
        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        }
      }

      if (!reg.active) {
        await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
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
      console.warn('SW showNotification failed:', swErr);
    }
  }

  // 2. Desktop Fallback: new Notification(...)
  const isMobileDevice =
    typeof navigator !== 'undefined' &&
    /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');

  if (!isMobileDevice) {
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
  return null;
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

  return await showImmediateSystemNotification('🔔 JK Message 알림 테스트', {
    body: `스마트폰 실제 알림이 정상 작동 중입니다. (${modeText})`,
    forceMode: effectiveMode,
  });
}

export interface ApkInfo {
  available: boolean;
  version?: string;
  fileName?: string;
  sizeBytes?: number;
  sizeMb?: string;
  updatedAt?: number;
  downloadUrl?: string;
  error?: string;
}

export async function fetchApkInfo(): Promise<ApkInfo | null> {
  try {
    const res = await fetch('/api/apk/info');
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('Failed to fetch APK info:', e);
    return null;
  }
}

export function downloadApkFile(): void {
  const link = document.createElement('a');
  link.href = '/download/JK-Messenger.apk';
  link.download = 'JK-Messenger.apk';
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
  }, 100);
}

/**
 * Register user with Native Android Service so background listener receives messages when app is closed
 */
export function registerNativeAndroidUser(userId: string, username?: string): void {
  if (typeof window === 'undefined') return;
  const bridge = (window as any).JKAndroidBridge || (window as any).AndroidBridge;
  if (bridge && typeof bridge.registerUser === 'function') {
    try {
      bridge.registerUser(userId, username || '');
    } catch (e) {
      console.warn('Native registerUser error:', e);
    }
  }
}


