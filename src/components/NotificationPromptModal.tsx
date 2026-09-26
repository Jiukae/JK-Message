import React, { useState } from 'react';
import { BellRing, Bell, X, Check, ShieldCheck } from 'lucide-react';
import { requestNotificationPermission, isIOS, isStandalonePWA } from '../utils/notifications';

interface NotificationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnabled?: () => void;
}

export const NotificationPromptModal: React.FC<NotificationPromptModalProps> = ({
  isOpen,
  onClose,
  onEnabled,
}) => {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // iPhone/iPad only allow push notifications for web apps added to the Home Screen (iOS 16.4+)
  const needsHomeScreenInstall = isIOS() && !isStandalonePWA();

  const handleEnable = async () => {
    setLoading(true);
    try {
      const permission = await requestNotificationPermission();
      if (permission === 'granted') {
        if (onEnabled) onEnabled();
      }
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-[#121622]/95 border border-white/20 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Glow effect header */}
        <div className="relative p-6 pt-7 text-center overflow-hidden border-b border-white/10 bg-gradient-to-b from-blue-600/10 to-transparent">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-blue-500/30 rounded-full blur-2xl pointer-events-none" />
          
          <button
            id="close-notif-modal-btn"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-white/50 hover:text-white p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 border border-white/20 flex items-center justify-center shadow-xl shadow-blue-500/25 animate-bounce duration-1000">
            <BellRing className="w-8 h-8 text-white" />
          </div>

          <h3 className="text-xl font-bold text-white tracking-tight">
            알림을 설정할까요?
          </h3>
          <p className="text-xs text-white/60 mt-2 leading-relaxed px-2">
            다른 사용자가 메시지를 보냈을 때<br />
            실시간 브라우저 푸시 알림으로 바로 확인하세요!
          </p>
        </div>

        {needsHomeScreenInstall && (
          <div className="mx-6 mt-5 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-400/30 text-[12px] leading-relaxed text-amber-100/90">
            📱 <b>아이폰/아이패드</b>는 앱을 꺼도 알림을 받으려면 먼저 홈 화면에 추가해야 해요.
            <br />
            Safari 하단 <b>공유 버튼</b> → <b>'홈 화면에 추가'</b> → 홈 화면의 JK Message 앱을 열고 알림을 켜주세요.
          </div>
        )}

        {/* Action buttons */}
        <div className="p-6 space-y-2.5">
          {!needsHomeScreenInstall && (
          <button
            id="enable-notification-btn"
            type="button"
            disabled={loading}
            onClick={handleEnable}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-semibold rounded-2xl text-sm shadow-lg shadow-blue-600/30 border border-blue-400/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Bell className="w-4 h-4" />
            <span>{loading ? '설정 중...' : '네, 알림 켜기'}</span>
          </button>
          )}

          <button
            id="skip-notification-btn"
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white font-medium rounded-2xl text-xs transition-all flex items-center justify-center"
          >
            <span>나중에 할게요</span>
          </button>
        </div>

        <div className="px-6 py-3 bg-black/30 border-t border-white/5 text-[11px] text-white/40 text-center flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
          <span>브라우저 권한 팝업이 뜨면 '허용'을 눌러주세요</span>
        </div>

      </div>
    </div>
  );
};
