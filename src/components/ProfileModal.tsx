import React, { useState, useRef } from 'react';
import { User, ChatTheme, NotificationMode } from '../types';
import {
  X,
  Copy,
  Check,
  Sparkles,
  User as UserIcon,
  LogOut,
  Camera,
  Trash2,
  Palette,
  Bell,
  Volume2,
  Smartphone,
  VolumeX,
  Sliders,
  CheckCircle2,
  RefreshCw,
  UploadCloud,
  Loader2,
  Layers,
} from 'lucide-react';
import { RoleBadge } from '../utils/roleUtils';
import { UserAvatar } from './UserAvatar';
import { sounds } from '../utils/audio';
import {
  sendTestNotification,
  requestNotificationPermission,
  getNotificationPermission,
  getPushDiagnostics,
  sendPushTest,
  syncPushSubscription,
} from '../utils/notifications';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onUpdate: (updated: User) => void;
  onLogout: () => void;
  initialTab?: 'profile' | 'background' | 'sound';
  onTriggerTestNotification?: (mode: NotificationMode) => void;
}

const AVATAR_GRADIENTS = [
  'from-blue-500 to-indigo-600',
  'from-rose-500 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-600',
  'from-violet-500 to-purple-700',
  'from-cyan-500 to-blue-600',
];

const AVATAR_EMOJIS = ['💬', '⚡', '🌸', '🚀', '🌿', '🐱', '🦊', '💡', '🔥', '🎧', '🌟', '🎯'];

// Curated Solid Color Presets
const SOLID_COLOR_PRESETS = [
  { name: '기본 다크', value: '#080711' },
  { name: '딥 네이비', value: '#0b1120' },
  { name: '슬레이트 차콜', value: '#151921' },
  { name: '에메랄드 슬레이트', value: '#061a14' },
  { name: '와인 버건디', value: '#1c0c16' },
  { name: '로열 바이올렛', value: '#140a24' },
  { name: '모던 그레이', value: '#181b22' },
  { name: '딥 블랙', value: '#000000' },
];

// Curated Gradient Presets
const GRADIENT_PRESETS = [
  {
    name: '네온 바이올렛',
    from: '#1a0c36',
    to: '#0b041a',
    angle: 135,
  },
  {
    name: '딥 오션',
    from: '#05182e',
    to: '#020b17',
    angle: 135,
  },
  {
    name: '로맨틱 선셋',
    from: '#2c0b22',
    to: '#110314',
    angle: 135,
  },
  {
    name: '에메랄드 나이트',
    from: '#06241a',
    to: '#03100b',
    angle: 135,
  },
  {
    name: '사이버펑크 네뷸라',
    from: '#1b124a',
    to: '#2f0c3d',
    angle: 145,
  },
  {
    name: '루비 크림슨',
    from: '#330b15',
    to: '#140207',
    angle: 135,
  },
  {
    name: '앰버 골드',
    from: '#2e1805',
    to: '#120801',
    angle: 135,
  },
  {
    name: '스타리 다크',
    from: '#0f172a',
    to: '#090d16',
    angle: 180,
  },
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onClose,
  onUpdate,
  onLogout,
  initialTab = 'profile',
  onTriggerTestNotification,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'background' | 'sound'>(initialTab);

  // Profile Form States
  const [name, setName] = useState(user.name);
  const [avatarBg, setAvatarBg] = useState(user.avatarBg || AVATAR_GRADIENTS[0]);
  const [avatarEmoji, setAvatarEmoji] = useState(user.avatarEmoji || '💬');
  const [avatarImage, setAvatarImage] = useState<string | null>(user.avatarImage || null);
  const [customStatus, setCustomStatus] = useState(user.customStatus || '');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Background Theme States
  const [bgType, setBgType] = useState<'default' | 'solid' | 'gradient'>(
    user.chatTheme?.type || 'default'
  );
  const [solidColor, setSolidColor] = useState<string>(
    user.chatTheme?.solidColor || SOLID_COLOR_PRESETS[0].value
  );
  const [gradientFrom, setGradientFrom] = useState<string>(
    user.chatTheme?.gradientFrom || GRADIENT_PRESETS[0].from
  );
  const [gradientTo, setGradientTo] = useState<string>(
    user.chatTheme?.gradientTo || GRADIENT_PRESETS[0].to
  );
  const [gradientAngle, setGradientAngle] = useState<number>(
    user.chatTheme?.gradientAngle !== undefined ? user.chatTheme.gradientAngle : 135
  );

  // Notification Mode State: 'sound' | 'vibrate' | 'silent'
  const [notificationMode, setNotificationMode] = useState<NotificationMode>(
    user.notificationMode || sounds.getNotificationMode()
  );

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [pushDiag, setPushDiag] = useState(() => getPushDiagnostics());
  const [pushTestResult, setPushTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pushTesting, setPushTesting] = useState(false);

  const handlePushTest = async () => {
    setPushTesting(true);
    setPushTestResult(null);
    try {
      if (getNotificationPermission() !== 'granted') {
        await requestNotificationPermission();
      }
      await syncPushSubscription(user.id);
      const result = await sendPushTest(10);
      setPushTestResult(result);
    } finally {
      setPushDiag(getPushDiagnostics());
      setPushTesting(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCopyId = () => {
    navigator.clipboard.writeText(`@${user.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Photo File Selection & Upload
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      alert('이미지 파일 크기는 10MB 이하만 가능합니다.');
      return;
    }

    setUploadingImage(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type,
              fileData: base64Data,
              fileSize: `${(file.size / 1024).toFixed(1)} KB`,
            }),
          });
          const data = await res.json();
          if (data.attachment?.url) {
            setAvatarImage(data.attachment.url);
          } else {
            // fallback directly to base64
            setAvatarImage(base64Data);
          }
        } catch {
          setAvatarImage(base64Data);
        } finally {
          setUploadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File reading error:', err);
      setUploadingImage(false);
    }
  };

  const handleRemovePhoto = () => {
    setAvatarImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Compute Current Preview Gradient/Color CSS
  const getThemeBackgroundStyle = () => {
    if (bgType === 'solid') {
      return solidColor;
    }
    if (bgType === 'gradient') {
      return `linear-gradient(${gradientAngle}deg, ${gradientFrom} 0%, ${gradientTo} 100%)`;
    }
    return 'linear-gradient(135deg, #0c0d18 0%, #161129 100%)';
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    const updatedTheme: ChatTheme = {
      type: bgType,
      solidColor: bgType === 'solid' ? solidColor : undefined,
      gradientFrom: bgType === 'gradient' ? gradientFrom : undefined,
      gradientTo: bgType === 'gradient' ? gradientTo : undefined,
      gradientAngle: bgType === 'gradient' ? gradientAngle : undefined,
    };

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          name: name.trim(),
          avatarBg,
          avatarEmoji,
          avatarImage,
          chatTheme: updatedTheme,
          notificationMode,
          customStatus: customStatus.trim(),
        }),
      });
      sounds.setNotificationMode(notificationMode);
      const data = await res.json();
      if (data.user) {
        onUpdate(data.user);
        onClose();
      }
    } catch (e) {
      console.error(e);
      alert('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Sound & Vibration Mode Testing
  const handleTestSpecificMode = (modeToTest: NotificationMode) => {
    sounds.unlockAudio();
    sounds.playIncomingMessage(modeToTest);
    if (modeToTest === 'sound') {
      setTestStatus('🔊 소리 모드: "띠링~" 수신음과 진동이 발생했습니다.');
    } else if (modeToTest === 'vibrate') {
      setTestStatus('📳 진동 모드: 소리 없이 진동만 발생했습니다.');
    } else {
      setTestStatus('🔕 무음 모드: 소리와 진동 없이 조용히 처리되었습니다.');
    }
    // Trigger the real top Heads-Up notification banner
    if (onTriggerTestNotification) {
      onTriggerTestNotification(modeToTest);
    }
    setTimeout(() => setTestStatus(null), 3500);
  };

  const handleTestHeadsUpBanner = async () => {
    sounds.unlockAudio();
    sounds.playIncomingMessage(notificationMode);
    if (onTriggerTestNotification) {
      onTriggerTestNotification(notificationMode);
    }
    setTestStatus('화면 상단에 실시간 알림 팝업("여기에 뜰 수 있게")이 표시되었습니다!');
    // Also try browser notification
    await sendTestNotification(notificationMode);
    setTimeout(() => setTestStatus(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[92vh] flex flex-col bg-[#111420]/95 border border-purple-500/20 rounded-3xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/30 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">내 설정</h2>
              <p className="text-[11px] text-white/50">프로필 사진, 커스텀 배경, 알림 및 사운드</p>
            </div>
          </div>
          <button
            id="close-profile-modal-btn"
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="shrink-0 flex items-center border-b border-white/10 bg-black/20 px-4 pt-2 gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-3.5 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 ${
              activeTab === 'profile'
                ? 'bg-white/10 text-white border-blue-400'
                : 'text-white/50 hover:text-white/80 border-transparent hover:bg-white/5'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>프로필 & 사진</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('background')}
            className={`px-3.5 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 ${
              activeTab === 'background'
                ? 'bg-white/10 text-white border-purple-400'
                : 'text-white/50 hover:text-white/80 border-transparent hover:bg-white/5'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-purple-400" />
            <span>배경 (단색/그라데이션)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sound')}
            className={`px-3.5 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 ${
              activeTab === 'sound'
                ? 'bg-white/10 text-white border-emerald-400'
                : 'text-white/50 hover:text-white/80 border-transparent hover:bg-white/5'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-emerald-400" />
            <span>휴대폰 알림 & 소리</span>
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          
          {/* ================= TAB 1: PROFILE & PHOTO ================= */}
          {activeTab === 'profile' && (
            <div className="space-y-5">
              {/* Photo & Avatar Card */}
              <div className="p-4 bg-black/25 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative group">
                  <UserAvatar
                    user={{
                      name,
                      avatarBg,
                      avatarEmoji,
                      avatarImage,
                    }}
                    size="xl"
                    shape="rounded-2xl"
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center text-white">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <span className="text-white font-bold text-base truncate">{name || user.name}</span>
                    <RoleBadge user={user} size="sm" />
                  </div>
                  
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
                    <span className="text-xs text-blue-400 font-mono bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-400/20">
                      @{user.username}
                    </span>
                    <button
                      id="copy-my-id-btn"
                      type="button"
                      onClick={handleCopyId}
                      className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
                      title="아이디 복사"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? '복사됨' : '복사'}</span>
                    </button>
                  </div>

                  {/* Photo Upload & Remove Buttons */}
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl border border-blue-400/30 flex items-center gap-1.5 shadow-md shadow-blue-600/25 transition-all"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{avatarImage ? '사진 변경' : '프로필 사진 업로드'}</span>
                    </button>

                    {avatarImage && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-xs font-medium rounded-xl border border-rose-500/30 flex items-center gap-1 transition-colors"
                        title="기본 이모지 아바타로 복원"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>사진 삭제</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* If no custom photo, show emoji & gradient customization */}
              {!avatarImage && (
                <div className="space-y-3.5 p-3.5 bg-white/[0.02] border border-white/5 rounded-2xl">
                  {/* Emoji choices */}
                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                      대표 이모지 선택
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVATAR_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatarEmoji(emoji)}
                          className={`w-9 h-9 rounded-xl text-base flex items-center justify-center transition-transform ${
                            avatarEmoji === emoji
                              ? 'bg-blue-600 text-white scale-110 shadow-md border border-blue-400/40'
                              : 'bg-white/5 hover:bg-white/10 text-white border border-white/5'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color choices */}
                  <div>
                    <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                      아바타 배경 색상
                    </label>
                    <div className="flex gap-2.5 flex-wrap">
                      {AVATAR_GRADIENTS.map((gradient) => (
                        <button
                          key={gradient}
                          type="button"
                          onClick={() => setAvatarBg(gradient)}
                          className={`w-8 h-8 rounded-full bg-gradient-to-tr ${gradient} border border-white/15 transition-transform ${
                            avatarBg === gradient ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Name input */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  이름 (닉네임)
                </label>
                <input
                  id="profile-name-input"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-500/30 transition-all backdrop-blur-sm"
                />
              </div>

              {/* Custom Status */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
                  상태 메시지
                </label>
                <input
                  id="profile-status-input"
                  type="text"
                  value={customStatus}
                  onChange={(e) => setCustomStatus(e.target.value)}
                  placeholder="오늘의 기분이나 상태를 적어주세요"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-500/30 transition-all backdrop-blur-sm"
                />
              </div>
            </div>
          )}

          {/* ================= TAB 2: BACKGROUND (SOLID & GRADIENT) ================= */}
          {activeTab === 'background' && (
            <div className="space-y-5">
              {/* Type Switcher: Default vs Solid vs Gradient */}
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                  배경 스타일 모드
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setBgType('default')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      bgType === 'default'
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                        : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                    }`}
                  >
                    <span>기본 테마</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgType('solid')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      bgType === 'solid'
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                        : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>단색 커스텀</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBgType('gradient')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                      bgType === 'gradient'
                        ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30'
                        : 'bg-white/5 text-white/60 hover:text-white border-white/10'
                    }`}
                  >
                    <Palette className="w-3.5 h-3.5" />
                    <span>그라데이션 커스텀</span>
                  </button>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3.5 bg-black/40 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-white/60">채팅방 실시간 배경 미리보기</span>
                  <span className="text-[10px] text-white/40 font-mono">
                    {bgType === 'solid' ? solidColor : bgType === 'gradient' ? `${gradientAngle}° Gradient` : 'Default'}
                  </span>
                </div>
                <div
                  className="w-full h-28 rounded-xl border border-white/15 p-3 flex flex-col justify-end gap-1.5 relative overflow-hidden transition-all shadow-inner"
                  style={{
                    background: getThemeBackgroundStyle(),
                  }}
                >
                  <div className="self-start max-w-[70%] px-2.5 py-1 rounded-2xl rounded-tl-none bg-[#181d2c]/90 text-white/90 text-[11px] border border-white/10 shadow-sm">
                    안녕하세요! 오늘 배경이 아주 깔끔하네요 😊
                  </div>
                  <div className="self-end max-w-[70%] px-2.5 py-1 rounded-2xl rounded-tr-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] border border-blue-400/30 shadow-sm">
                    단색과 그라데이션 커스텀 완료! 🚀
                  </div>
                </div>
              </div>

              {/* Solid Color Controls */}
              {bgType === 'solid' && (
                <div className="space-y-3 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                  <label className="block text-xs font-semibold text-white/80">단색 프리셋 선택</label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {SOLID_COLOR_PRESETS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setSolidColor(item.value)}
                        title={item.name}
                        className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                          solidColor.toLowerCase() === item.value.toLowerCase()
                            ? 'ring-2 ring-white scale-105 border-white'
                            : 'border-white/20 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: item.value }}
                      >
                        {solidColor.toLowerCase() === item.value.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Custom Color Input */}
                  <div className="pt-2 border-t border-white/10 flex items-center gap-3">
                    <label className="text-xs text-white/70 font-medium">직접 색상 지정:</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={solidColor}
                        onChange={(e) => setSolidColor(e.target.value)}
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                      />
                      <input
                        type="text"
                        value={solidColor}
                        onChange={(e) => setSolidColor(e.target.value)}
                        className="w-24 px-2 py-1 bg-white/5 border border-white/15 rounded-lg text-white font-mono text-xs focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Gradient Controls */}
              {bgType === 'gradient' && (
                <div className="space-y-3.5 p-4 bg-white/[0.02] border border-white/10 rounded-2xl">
                  <label className="block text-xs font-semibold text-white/80">그라데이션 프리셋 선택</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {GRADIENT_PRESETS.map((g) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => {
                          setGradientFrom(g.from);
                          setGradientTo(g.to);
                          setGradientAngle(g.angle);
                        }}
                        className={`p-2 rounded-xl border text-left transition-all ${
                          gradientFrom === g.from && gradientTo === g.to
                            ? 'ring-2 ring-white border-white scale-[1.02]'
                            : 'border-white/15 opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          background: `linear-gradient(${g.angle}deg, ${g.from} 0%, ${g.to} 100%)`,
                        }}
                      >
                        <span className="block text-[11px] font-bold text-white drop-shadow">
                          {g.name}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Custom Gradient Pickers */}
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="block text-[11px] text-white/60 mb-1">시작 색상</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={gradientFrom}
                            onChange={(e) => setGradientFrom(e.target.value)}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                          />
                          <input
                            type="text"
                            value={gradientFrom}
                            onChange={(e) => setGradientFrom(e.target.value)}
                            className="w-full px-2 py-1 bg-white/5 border border-white/15 rounded-lg text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <span className="block text-[11px] text-white/60 mb-1">끝 색상</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={gradientTo}
                            onChange={(e) => setGradientTo(e.target.value)}
                            className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                          />
                          <input
                            type="text"
                            value={gradientTo}
                            onChange={(e) => setGradientTo(e.target.value)}
                            className="w-full px-2 py-1 bg-white/5 border border-white/15 rounded-lg text-white font-mono text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Angle Slider */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-white/70 mb-1">
                        <span>그라데이션 각도 ({gradientAngle}°)</span>
                        <span className="font-mono">{gradientAngle}°</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={gradientAngle}
                        onChange={(e) => setGradientAngle(parseInt(e.target.value, 10))}
                        className="w-full accent-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: NOTIFICATIONS & SOUND ================= */}
          {activeTab === 'sound' && (
            <div className="space-y-4">
              {/* Notification Mode Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    알림 모드 설정 (소리 / 진동 / 무음)
                  </label>
                  <span className="text-[11px] text-white/50">
                    선택 즉시 적용됩니다
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Mode 1: Sound */}
                  <div
                    onClick={() => {
                      setNotificationMode('sound');
                      sounds.setNotificationMode('sound');
                    }}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      notificationMode === 'sound'
                        ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-600/20 ring-1 ring-blue-400/50'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      {notificationMode === 'sound' && (
                        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-white">소리 모드</h5>
                    <p className="text-[11px] text-white/60 mt-1 leading-snug">
                      소리일 땐 "띠링~" 수신음 재생 및 진동
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationMode('sound');
                        sounds.setNotificationMode('sound');
                        handleTestSpecificMode('sound');
                      }}
                      className="mt-3 w-full py-1.5 px-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-lg text-[10px] font-semibold border border-blue-400/25 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>소리 테스트</span>
                    </button>
                  </div>

                  {/* Mode 2: Vibrate */}
                  <div
                    onClick={() => {
                      setNotificationMode('vibrate');
                      sounds.setNotificationMode('vibrate');
                    }}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      notificationMode === 'vibrate'
                        ? 'bg-amber-600/20 border-amber-500 shadow-lg shadow-amber-600/20 ring-1 ring-amber-400/50'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      {notificationMode === 'vibrate' && (
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-white">진동 모드</h5>
                    <p className="text-[11px] text-white/60 mt-1 leading-snug">
                      진동일 땐 소리 없이 기기 진동만 발생
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationMode('vibrate');
                        sounds.setNotificationMode('vibrate');
                        handleTestSpecificMode('vibrate');
                      }}
                      className="mt-3 w-full py-1.5 px-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-lg text-[10px] font-semibold border border-amber-400/25 flex items-center justify-center gap-1 transition-colors"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>진동 테스트</span>
                    </button>
                  </div>

                  {/* Mode 3: Silent */}
                  <div
                    onClick={() => {
                      setNotificationMode('silent');
                      sounds.setNotificationMode('silent');
                    }}
                    className={`p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      notificationMode === 'silent'
                        ? 'bg-purple-600/20 border-purple-500 shadow-lg shadow-purple-600/20 ring-1 ring-purple-400/50'
                        : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-400">
                        <VolumeX className="w-4 h-4" />
                      </div>
                      {notificationMode === 'silent' && (
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                      )}
                    </div>
                    <h5 className="text-xs font-bold text-white">무음 모드</h5>
                    <p className="text-[11px] text-white/60 mt-1 leading-snug">
                      무음일 땐 소리도 진동도 안 남 (화면만)
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationMode('silent');
                        sounds.setNotificationMode('silent');
                        handleTestSpecificMode('silent');
                      }}
                      className="mt-3 w-full py-1.5 px-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-[10px] font-semibold border border-purple-400/25 flex items-center justify-center gap-1 transition-colors"
                    >
                      <VolumeX className="w-3 h-3" />
                      <span>무음 테스트</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Real Top Heads-Up Notification Tester */}
              <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-purple-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        화면 상단 알림 팝업 ("여기에 뜰 수 있게")
                      </h4>
                      <p className="text-[11px] text-white/50">
                        메시지 도착 시 스마트폰 상단에서 샥 내려오는 알림 카드
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestHeadsUpBanner}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:opacity-90 active:scale-[0.99] text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/25 border border-white/20 flex items-center justify-center gap-2 transition-all"
                >
                  <Bell className="w-4 h-4 animate-bounce" />
                  <span>지금 상단 알림 팝업 띄워보기 (테스트)</span>
                </button>

                {testStatus && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{testStatus}</span>
                  </div>
                )}
              </div>

              {/* Background Web Push (app closed / screen off) */}
              <div className="p-3 bg-black/30 rounded-xl border border-white/10 space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-white/80 font-medium block truncate">
                      앱을 꺼도 오는 백그라운드 푸시
                    </span>
                    <span className="text-[10px] text-white/40 block">
                      앱이 닫혀 있거나 화면이 꺼져 있어도 알림 받기
                    </span>
                  </div>
                  {pushDiag.active ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold shrink-0">
                      이 기기 등록됨
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-bold shrink-0">
                      미등록
                    </span>
                  )}
                </div>

                {!pushDiag.active && pushDiag.error && (
                  <p className="text-[11px] text-rose-300/90 leading-relaxed">⚠️ {pushDiag.error}</p>
                )}

                <button
                  type="button"
                  disabled={pushTesting}
                  onClick={handlePushTest}
                  className="w-full py-2.5 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold border border-white/15 transition-colors disabled:opacity-50"
                >
                  {pushTesting ? '확인 중...' : '📲 10초 뒤 푸시 보내기 (보낸 뒤 앱을 꺼보세요)'}
                </button>

                {pushTestResult && (
                  <p
                    className={`text-[11px] leading-relaxed ${
                      pushTestResult.ok ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {pushTestResult.ok ? '✅ ' : '❌ '}
                    {pushTestResult.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between border-t border-white/10">
            <button
              id="logout-btn"
              type="button"
              onClick={onLogout}
              className="px-3 py-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>

            <div className="flex gap-2">
              <button
                id="cancel-profile-btn"
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white text-sm font-semibold rounded-2xl transition-colors"
              >
                취소
              </button>
              <button
                id="save-profile-btn"
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-2xl shadow-lg shadow-blue-600/30 border border-blue-400/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {saving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
