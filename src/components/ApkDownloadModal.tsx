import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bell,
  Sparkles,
  Zap,
} from 'lucide-react';
import { fetchApkInfo, downloadApkFile, isNativeAndroidApp, ApkInfo } from '../utils/notifications';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ isOpen, onClose }) => {
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [showReasonDetail, setShowReasonDetail] = useState(true);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const isNative = isNativeAndroidApp();

  useEffect(() => {
    if (isOpen) {
      fetchApkInfo().then(setApkInfo);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloadStarted(true);
    downloadApkFile();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0e111a] border border-blue-500/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">JK Message 안드로이드 전용 APK</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  v1.0.0 정식
                </span>
              </div>
              <p className="text-xs text-blue-200/70">
                스마트폰을 닫아두어도 상단바/잠금화면에 카카오톡처럼 100% 알림 수신
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-sm">
          {/* Native App Banner (if already running in APK) */}
          {isNative ? (
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-white text-xs">현재 전용 APK 앱에서 접속 중입니다!</p>
                <p className="text-[11px] text-emerald-300/80 mt-1 leading-relaxed">
                  네이티브 백그라운드 서비스 및 알림 매니저가 활성화되어 있어 앱을 최소화하거나 화면이 꺼져 있어도 실시간 알림이 즉시 울립니다.
                </p>
              </div>
            </div>
          ) : (
            /* Main Download Box */
            <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-950/60 to-black/60 border border-blue-500/40 shadow-inner space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white/90">공식 서명 완료된 안드로이드 패키지 (.apk)</span>
                </div>
                <span className="text-[11px] text-white/50">
                  {apkInfo?.sizeMb ? `${apkInfo.sizeMb}` : '17 KB'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleDownload}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 text-sm"
              >
                <Download className="w-5 h-5 animate-bounce" />
                <span>안드로이드 APK 다운로드 (JK-Messenger.apk)</span>
              </button>

              {downloadStarted && (
                <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0" />
                  <span>다운로드가 시작되었습니다! 브라우저 다운로드 창을 확인하세요.</span>
                </div>
              )}
            </div>
          )}

          {/* Why Web/WebSocket Notification Doesn't Work When Closed */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowReasonDetail(!showReasonDetail)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="font-bold text-xs text-white">
                  웹(WebSocket)에서 앱을 닫으면 알림이 안 울리는 이유
                </span>
              </div>
              {showReasonDetail ? (
                <ChevronUp className="w-4 h-4 text-white/50" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/50" />
              )}
            </button>

            {showReasonDetail && (
              <div className="p-4 pt-0 space-y-3 text-xs border-t border-white/5 bg-black/20">
                <div className="space-y-2 mt-2">
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200">
                    <p className="font-bold text-rose-300 flex items-center gap-1.5 mb-1">
                      <span>1. 모바일 OS의 배터리 절전 및 프로세스 동결 (Doze Mode)</span>
                    </p>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      스마트폰 화면이 꺼지거나 브라우저 창을 닫으면, 안드로이드 OS는 배터리 절약을 위해 웹페이지의 자바스크립트 엔진과 WebSocket TCP 연결을 즉시 강제 종료(Freeze)합니다.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200">
                    <p className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                      <span>2. 백그라운드 소켓 수신 불가</span>
                    </p>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      웹소켓은 브라우저 탭이 활성화되어 켜져 있을 때만 데이터를 받습니다. 브라우저가 닫히면 서버에서 아무리 메시지를 보내도 폰 내부로 들어갈 통로가 차단됩니다.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
                    <p className="font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5" />
                      <span>3. 전용 APK 앱에서는 왜 100% 울릴까요?</span>
                    </p>
                    <p className="text-[11px] text-white/70 leading-relaxed">
                      전용 APK에는 시스템 백그라운드 포어그라운드 서비스(<code className="text-emerald-300">JKNotificationService</code>)와 안드로이드 네이티브 <code className="text-emerald-300">NotificationManager</code>가 탑재되어 있어, 화면이 꺼져도 OS가 연결을 끊지 않고 메시지 수신 즉시 잠금화면과 상단바에 알림/진동을 울립니다!
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3-Step Installation Guide */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>간단 3단계 APK 설치 방법</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="inline-block w-5 h-5 rounded-full bg-blue-500 text-white font-black text-center text-[11px] leading-5">
                  1
                </span>
                <p className="font-bold text-white text-[11px]">APK 다운로드</p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  위 버튼을 눌러 스마트폰에 <code className="text-blue-300">JK-Messenger.apk</code> 파일을 저장합니다.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="inline-block w-5 h-5 rounded-full bg-indigo-500 text-white font-black text-center text-[11px] leading-5">
                  2
                </span>
                <p className="font-bold text-white text-[11px]">설치 진행</p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  다운로드된 파일을 터치하여 설치합니다. (보안 경고 발생 시 '무시하고 설치' 선택)
                </p>
              </div>

              <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                <span className="inline-block w-5 h-5 rounded-full bg-purple-500 text-white font-black text-center text-[11px] leading-5">
                  3
                </span>
                <p className="font-bold text-white text-[11px]">알림 허용</p>
                <p className="text-[10px] text-white/50 leading-relaxed">
                  앱을 실행하고 첫 화면에서 <strong>'알림 허용'</strong>을 누르면 카카오톡처럼 닫혀있어도 알림이 도착합니다!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between">
          <span className="text-[11px] text-white/40">
            Android 7.0 ~ Android 15+ 전체 기기 호환
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/30"
            >
              <Download className="w-3.5 h-3.5" />
              <span>다운로드</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold rounded-xl"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
