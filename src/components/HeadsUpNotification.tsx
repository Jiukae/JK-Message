import React, { useEffect, useState, useRef } from 'react';
import { Message, User, NotificationMode } from '../types';
import { UserAvatar } from './UserAvatar';
import { X, Volume2, Smartphone, VolumeX, MessageCircle, ChevronRight } from 'lucide-react';

export interface HeadsUpNotificationData {
  id: string;
  message: Message;
  sender?: Partial<User> | null;
  mode: NotificationMode;
}

interface HeadsUpNotificationProps {
  notification: HeadsUpNotificationData | null;
  onClose: () => void;
  onClick: (conversationId: string) => void;
}

export const HeadsUpNotification: React.FC<HeadsUpNotificationProps> = ({
  notification,
  onClose,
  onClick,
}) => {
  const [startY, setStartY] = useState<number | null>(null);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isDismissing, setIsDismissing] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!notification) {
      setOffsetY(0);
      setIsDismissing(false);
      return;
    }

    setOffsetY(0);
    setIsDismissing(false);

    // Haptic feedback on appear
    if (notification.mode !== 'silent' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(notification.mode === 'sound' ? [120, 50, 150] : [200, 100, 200]);
      } catch {}
    }

    // Auto-dismiss after 5 seconds
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      handleDismiss();
    }, 5200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification?.id]);

  if (!notification) return null;

  const handleDismiss = () => {
    setIsDismissing(true);
    setTimeout(() => {
      onClose();
      setIsDismissing(false);
      setOffsetY(0);
    }, 250);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY === null) return;
    const deltaY = e.touches[0].clientY - startY;
    // Allow dragging upwards to dismiss
    if (deltaY < 0) {
      setOffsetY(deltaY);
    }
  };

  const handleTouchEnd = () => {
    if (offsetY < -40) {
      handleDismiss();
    } else {
      setOffsetY(0);
    }
    setStartY(null);
  };

  const senderName = notification.sender?.name || '새 메시지';
  const messageText =
    notification.message.text ||
    (notification.message.attachment ? '📎 파일이 전송되었습니다.' : '새 메시지가 도착했습니다.');

  return (
    <div
      className={`fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-[9999] w-[94%] max-w-[420px] transition-all duration-200 select-none pt-[env(safe-area-inset-top,0px)] ${
        isDismissing ? '-translate-y-28 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
      style={{
        transform: `translate(-50%, ${offsetY}px)`,
        transition: startY !== null ? 'none' : undefined,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        onClick={() => onClick(notification.message.conversationId)}
        className="group relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#141624]/95 border border-white/20 shadow-[0_16px_50px_rgba(0,0,0,0.65)] backdrop-blur-2xl text-white cursor-pointer active:scale-[0.99] transition-transform hover:border-purple-400/40"
      >
        {/* Top subtle highlight reflection */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        {/* Card Header (App name, time, mode indicator, close) */}
        <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between text-xs border-b border-white/5">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Mini App Icon */}
            <div className="w-4 h-4 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-[10px] shadow-sm">
              <MessageCircle className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-bold text-[11px] text-white/90 tracking-tight">JK Message</span>
            <span className="text-[10px] text-white/40">• 지금</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Notification Mode Tag */}
            {notification.mode === 'sound' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/20 text-[9px] font-semibold">
                <Volume2 className="w-2.5 h-2.5" />
                <span>소리</span>
              </span>
            )}
            {notification.mode === 'vibrate' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/20 text-[9px] font-semibold">
                <Smartphone className="w-2.5 h-2.5" />
                <span>진동</span>
              </span>
            )}
            {notification.mode === 'silent' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/20 text-[9px] font-semibold">
                <VolumeX className="w-2.5 h-2.5" />
                <span>무음</span>
              </span>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className="p-1 -mr-1 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              title="닫기"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card Body: Sender Avatar & Message Preview */}
        <div className="p-3 flex items-center gap-3">
          <div className="relative shrink-0">
            <UserAvatar user={notification.sender} size="md" shape="rounded-xl" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs sm:text-sm text-white truncate">
                {senderName}
              </span>
              {notification.sender?.username && (
                <span className="text-[10px] text-blue-400/80 font-mono truncate">
                  @{notification.sender.username}
                </span>
              )}
            </div>
            <p className="text-xs text-white/80 line-clamp-2 mt-0.5 font-normal leading-snug">
              {messageText}
            </p>
          </div>

          {/* Quick Action Button */}
          <div className="shrink-0 flex items-center">
            <span className="inline-flex items-center gap-0.5 px-2.5 py-1 rounded-xl bg-blue-600/90 text-white text-[11px] font-bold shadow-md shadow-blue-600/30 group-hover:bg-blue-500 transition-colors">
              <span>열기</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* Bottom animated countdown bar */}
        <div className="h-0.5 w-full bg-white/5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 animate-out"
            style={{
              animation: 'linear 5000ms headsUpTimer forwards',
            }}
          />
        </div>
      </div>
      
      {/* Swipe up prompt dot */}
      <div className="flex justify-center mt-1">
        <div className="w-8 h-1 rounded-full bg-white/20" />
      </div>
    </div>
  );
};
