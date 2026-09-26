// Browser & Mobile ServiceWorker Notification utility for JK Message
import { sounds } from './audio';
import { NotificationMode } from '../types';

let swRegistration: ServiceWorkerRegistration | null = null;

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
