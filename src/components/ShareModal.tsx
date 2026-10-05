import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Crown,
  Sparkles,
  Users,
  CheckCircle2,
  ArrowRight,
  Send,
  Smartphone,
} from 'lucide-react';
import { User } from '../types';
import { TitleBadge } from './TitleBadge';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  friendsCount: number;
  onUserUpdate: (updated: User) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  friendsCount,
  onUserUpdate,
}) => {
  const [copied, setCopied] = useState(false);
  const [justAwardedTitle, setJustAwardedTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  // Base URL for invite (using current origin or fallback)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://jk-message.onrender.com';
  const inviteUrl = `${baseUrl}/signup?ref=${encodeURIComponent(currentUser.username)}`;
  const shareText = `🚀 ${currentUser.name}님이 JK Message 메신저로 초대했습니다!\n지금 가입하고 실시간으로 대화해보세요:\n${inviteUrl}`;

  const hasShareKing = currentUser.titles?.includes('공유왕');
  const hasSocialButterfly = currentUser.titles?.includes('인싸') || friendsCount >= 10;

  // Record share on server and award title
  const recordShareAction = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/user/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onUserUpdate(data.user);
        if (data.isNewTitle) {
          setJustAwardedTitle('공유왕');
        }
      }
    } catch (e) {
      console.warn('Failed to record share on server:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      recordShareAction();
    } catch (e) {
      // Fallback
      prompt('초대 링크를 복사하세요:', inviteUrl);
      recordShareAction();
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'JK Message 초대',
          text: shareText,
          url: inviteUrl,
        });
        recordShareAction();
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const friendsProgress = Math.min(100, Math.round((friendsCount / 10) * 100));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121622]/95 border border-white/15 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="relative p-5 pb-4 bg-gradient-to-r from-amber-600/30 via-purple-600/20 to-indigo-600/30 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-lg shadow-amber-500/20">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                  <span>친구 초대하고 칭호 받기</span>
                </h3>
                <p className="text-xs text-amber-200/80">공유하면 '공유왕', 10명 모으면 '인싸'!</p>
              </div>
            </div>

            <button
              id="close-share-modal-btn"
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[80vh] overflow-y-auto">

          {/* Just Awarded Banner */}
          {justAwardedTitle && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400/40 text-amber-200 text-sm flex items-center gap-3 animate-in zoom-in-95 duration-300">
              <Crown className="w-6 h-6 text-amber-300 shrink-0 animate-bounce" />
              <div>
                <p className="font-bold text-white text-base">축하합니다! 👑 '공유왕' 획득!</p>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  내 프로필과 채팅 메시지에 '공유왕' 칭호가 즉시 장착되었습니다.
                </p>
              </div>
            </div>
          )}

          {/* Titles Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Card 1: 공유왕 */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              hasShareKing
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <TitleBadge title="공유왕" size="sm" />
                {hasShareKing ? (
                  <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 보유 중
                  </span>
                ) : (
                  <span className="text-[10px] text-white/40">미보유</span>
                )}
              </div>
              <p className="text-xs text-white/80 leading-snug">
                친구에게 메신저를 공유하면 즉시 획득!
              </p>
              <div className="mt-2 text-[10px] text-amber-300/80 font-mono">
                총 공유: {currentUser.shareCount || 0}회
              </div>
            </div>

            {/* Card 2: 인싸 */}
            <div className={`p-3.5 rounded-2xl border transition-all ${
              hasSocialButterfly
                ? 'bg-purple-500/10 border-purple-500/30'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <TitleBadge title="인싸" size="sm" />
                {hasSocialButterfly ? (
                  <span className="text-[10px] text-purple-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 달성!
                  </span>
                ) : (
                  <span className="text-[10px] text-white/40">
                    {friendsCount} / 10명
                  </span>
                )}
              </div>
              <p className="text-xs text-white/80 leading-snug">
                친구를 10명 이상 추가하면 자동 획득!
              </p>
              {/* Progress bar */}
              <div className="mt-2 space-y-1">
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                    style={{ width: `${friendsProgress}%` }}
                  />
                </div>
                <div className="text-[9px] text-purple-300/80 flex justify-between">
                  <span>진행도 {friendsProgress}%</span>
                  <span>{friendsCount >= 10 ? '완료' : `${10 - friendsCount}명 남음`}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Invite Link Box */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/80 flex items-center justify-between">
              <span>내 전용 친구 초대 링크</span>
              <span className="text-[11px] text-blue-400 font-mono">@{currentUser.username}</span>
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-black/40 border border-white/15">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="bg-transparent text-xs text-white/90 flex-1 outline-none select-all truncate px-1"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shrink-0 ${
                  copied
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                    : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>복사됨!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>링크 복사</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              id="share-native-btn"
              type="button"
              onClick={handleNativeShare}
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all transform active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4 text-black" />
              <span>카카오톡 / 스마트폰으로 친구에게 공유하기</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>링크 복사해서 메시지로 직접 보내기</span>
            </button>
          </div>

          {/* Tip Note */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-200/90 leading-relaxed">
            💡 <strong>칭호 착용 안내</strong>: 획득한 칭호(공유왕, 인싸)는 프로필 설정에서 언제든지 착용하거나 변경할 수 있으며, 채팅방 및 친구 목록에서 모든 사용자에게 자랑스럽게 노출됩니다!
          </div>

        </div>

      </div>
    </div>
  );
};
