// Browser & Mobile ServiceWorker Notification utility for JK Message
import { sounds } from './audio';

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
  onClick?: () => void;
}

export async function sendBrowserNotification(
  title: string,
  options: NotificationPayloadOptions
): Promise<Notification | null> {
  // Always trigger sound & haptic vibration
  sounds.playIncomingMessage();

  if (typeof window === 'undefined') return null;

  // Check vibration support
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(options.vibrate || [200, 100, 200, 100, 200]);
    } catch {}
  }

  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return null;
  }

  const defaultIcon = '/icons/icon-192.svg';
  const defaultBadge = '/icons/icon-192.svg';

  // 1. Mobile Priority: ServiceWorkerRegistration.showNotification()
  // (Crucial for Android Chrome, Samsung Internet, and mobile PWAs where `new Notification()` throws Illegal Constructor error)
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
          vibrate: options.vibrate || [200, 100, 200, 100, 200],
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
      silent: false,
    });

    notification.onclick = () => {
      window.focus();
      if (options.onClick) {
        options.onClick();
      }
      notification.close();
    };

    // Auto-close notification after 6 seconds
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
export async function sendTestNotification(): Promise<boolean> {
  const perm = await requestNotificationPermission();
  if (perm !== 'granted') return false;

  await sendBrowserNotification('🔔 JK Message 알림 테스트', {
    body: '휴대폰 알림 및 메시지 수신음("띠링~")이 정상 작동합니다!',
  });
  return true;
}
