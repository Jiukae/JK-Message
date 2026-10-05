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
  Download,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Crown,
  Share2,
  Award,
} from 'lucide-react';
import { RoleBadge } from '../utils/roleUtils';
import { UserAvatar } from './UserAvatar';
import { TitleBadge } from './TitleBadge';
import { sounds } from '../utils/audio';
import {
  sendTestNotification,
  requestNotificationPermission,
  getNotificationPermission,
  showImmediateSystemNotification,
  subscribeUserToPush,
  isPushSubscribed,
  triggerDelayedPushTest,
  isNativeAndroidApp,
  downloadApkFile,
  fetchApkInfo,
  ApkInfo,
} from '../utils/notifications';

interface ProfileModalProps {
  user: User;
  friendsCount?: number;
  onClose: () => void;
  onUpdate: (updated: User) => void;
  onLogout: () => void;
  initialTab?: 'profile' | 'background' | 'sound' | 'titles';
  onTriggerTestNotification?: (mode: NotificationMode) => void;
  onOpenShareModal?: () => void;
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
  friendsCount = 0,
  onClose,
  onUpdate,
  onLogout,
  initialTab = 'profile',
  onTriggerTestNotification,
  onOpenShareModal,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'titles' | 'background' | 'sound'>(initialTab);
  const [selectedTitle, setSelectedTitle] = useState<string | null>(user.selectedTitle || null);
  const [titleUpdating, setTitleUpdating] = useState(false);

  const handleSelectTitle = async (title: string | null) => {
    setSelectedTitle(title);
    setTitleUpdating(true);
    try {
      const res = await fetch('/api/user/select-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onUpdate(data.user);
      }
    } catch (e) {
      console.warn('Failed to update title:', e);
    } finally {
      setTitleUpdating(false);
    }
  };

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
  const [permStatus, setPermStatus] = useState<NotificationPermission | 'unsupported'>(() =>
    getNotificationPermission()
  );
  const [pushActive, setPushActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  // APK States
  const isNative = isNativeAndroidApp();
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [showWebReason, setShowWebReason] = useState(false);
  const [apkDownloaded, setApkDownloaded] = useState(false);

  React.useEffect(() => {
    isPushSubscribed().then(setPushActive);
    fetchApkInfo().then(setApkInfo);
  }, []);

  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

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

  // 1. Enable Real Device Notification & Web Push
  const handleEnablePush = async () => {
    sounds.unlockAudio();
    const res = await requestNotificationPermission(user.id);
    setPermStatus(res);
    if (res === 'granted') {
      const ok = await subscribeUserToPush(user.id);
      setPushActive(ok);
      setTestStatus('✅ 스마트폰 알림 권한 허용 및 백그라운드 푸시가 성공적으로 연동되었습니다!');
    } else {
      setTestStatus('⚠️ 알림 권한이 허용되지 않았습니다. 브라우저 주소창 자물쇠 아이콘에서 알림을 허용해주세요.');
    }
    setTimeout(() => setTestStatus(null), 4500);
  };

  // 2. Immediate Real System/OS Notification Card Test
  const handleImmediateOsTest = async () => {
    sounds.unlockAudio();
    if (permStatus !== 'granted') {
      const res = await requestNotificationPermission(user.id);
      setPermStatus(res);
      if (res !== 'granted') {
        setTestStatus('스마트폰 알림 권한을 먼저 허용해주세요.');
        return;
      }
    }
    const ok = await showImmediateSystemNotification('🔔 [JK Message] 실제 기기 알림', {
      body: `스마트폰 자체 알림이 정상 수신되었습니다! (${notificationMode === 'sound' ? '소리+진동' : notificationMode === 'vibrate' ? '진동만' : '무음'})`,
      forceMode: notificationMode,
    });
    if (ok) {
      setTestStatus('📱 스마트폰 상단바에 실제 시스템 알림 카드가 떴습니다!');
    } else {
      setTestStatus('스마트폰 알림 발송을 재시도합니다.');
    }
    setTimeout(() => setTestStatus(null), 4000);
  };

  // 3. Delayed Real OS Push Notification (To test with browser closed / screen locked)
  const handleDelayedPushTest = async () => {
    sounds.unlockAudio();
    if (permStatus !== 'granted') {
      const res = await requestNotificationPermission(user.id);
      setPermStatus(res);
      if (res !== 'granted') {
        setTestStatus('스마트폰 알림 권한을 먼저 허용해주세요.');
        return;
      }
    }

    setCountdown(3);
    setTestStatus('⏳ 3초 카운트다운! 지금 바로 화면을 끄거나 홈 화면으로 나가보세요!');

    await triggerDelayedPushTest(user.id, 3);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setTestStatus('🚀 실제 스마트폰 기기 푸시 알림이 발송되었습니다! (화면 상단바 확인)');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleTestHeadsUpBanner = () => {
    sounds.unlockAudio();
    sounds.playIncomingMessage(notificationMode);
    if (onTriggerTestNotification) {
      onTriggerTestNotification(notificationMode);
    }
    setTestStatus('화면 상단에 실시간 인앱 알림 팝업("여기에 뜰 수 있게")이 표시되었습니다!');
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
            onClick={() => setActiveTab('titles')}
            className={`px-3.5 py-2.5 rounded-t-xl text-xs font-semibold flex items-center gap-1.5 transition-all border-b-2 ${
              activeTab === 'titles'
                ? 'bg-white/10 text-white border-amber-400'
                : 'text-white/50 hover:text-white/80 border-transparent hover:bg-white/5'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-400" />
            <span>칭호 & 업적</span>
            {user.titles && user.titles.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            )}
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
                    {selectedTitle && (
                      <TitleBadge title={selectedTitle} size="sm" />
                    )}
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

          {/* ================= TAB: TITLES & ACHIEVEMENTS ================= */}
          {activeTab === 'titles' && (
            <div className="space-y-5">
              
              {/* Currently Equipped Title Card */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-white/15 rounded-2xl">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-white/50 block font-medium">현재 착용 중인 칭호</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-base font-bold text-white">{name || user.name}</span>
                      {selectedTitle ? (
                        <TitleBadge title={selectedTitle} size="md" />
                      ) : (
                        <span className="text-xs text-white/40 italic">(장착된 칭호 없음)</span>
                      )}
                    </div>
                  </div>
                  {selectedTitle && (
                    <button
                      type="button"
                      disabled={titleUpdating}
                      onClick={() => handleSelectTitle(null)}
                      className="px-2.5 py-1 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors"
                    >
                      칭호 해제
                    </button>
                  )}
                </div>
              </div>

              {/* Unlocked Titles Selector */}
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">
                  보유한 칭호 선택 (클릭하여 착용)
                </label>
                {(!user.titles || user.titles.length === 0) ? (
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-xs text-white/40">
                    아직 획득한 칭호가 없습니다. 아래 업적을 달성해보세요!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {user.titles.map((t) => {
                      const isEquipped = selectedTitle === t;
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={titleUpdating}
                          onClick={() => handleSelectTitle(t)}
                          className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all ${
                            isEquipped
                              ? 'bg-amber-500/15 border-amber-400/50 shadow-md shadow-amber-500/15 ring-1 ring-amber-400/30'
                              : 'bg-white/5 hover:bg-white/10 border-white/10'
                          }`}
                        >
                          <TitleBadge title={t} size="sm" />
                          {isEquipped ? (
                            <span className="text-[10px] text-amber-300 font-bold flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> 착용 중
                            </span>
                          ) : (
                            <span className="text-[10px] text-white/40 hover:text-white/70">
                              착용하기
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Achievements & Requirements */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider">
                  칭호 획득 미션
                </label>

                {/* 1. 공유왕 */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300">
                        <Crown className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">공유왕</span>
                          <TitleBadge title="공유왕" size="xs" />
                        </div>
                        <p className="text-[11px] text-white/50">친구에게 초대 링크 공유 시 획득</p>
                      </div>
                    </div>

                    {user.titles?.includes('공유왕') ? (
                      <span className="text-xs text-amber-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 획득 완료!
                      </span>
                    ) : (
                      <span className="text-xs text-white/40">미달성</span>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-white/5">
                    <span className="text-[11px] text-white/40">
                      총 공유 횟수: <strong className="text-white">{user.shareCount || 0}회</strong>
                    </span>
                    {onOpenShareModal && (
                      <button
                        type="button"
                        onClick={onOpenShareModal}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-1 shadow-md shadow-amber-500/20 transition-all"
                      >
                        <Share2 className="w-3 h-3 text-black" />
                        <span>친구에게 공유하기</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. 인싸 */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">인싸</span>
                          <TitleBadge title="인싸" size="xs" />
                        </div>
                        <p className="text-[11px] text-white/50">친구 10명 이상 추가 시 자동 획득</p>
                      </div>
                    </div>

                    {(user.titles?.includes('인싸') || friendsCount >= 10) ? (
                      <span className="text-xs text-purple-300 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 획득 완료!
                      </span>
                    ) : (
                      <span className="text-xs text-white/40">{friendsCount} / 10명</span>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-1 space-y-1">
                    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round((friendsCount / 10) * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-white/40">
                      <span>진행도 {Math.min(100, Math.round((friendsCount / 10) * 100))}%</span>
                      <span>{friendsCount >= 10 ? '완료' : `${10 - friendsCount}명 남음`}</span>
                    </div>
                  </div>
                </div>

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

              {/* ANDROID NATIVE APK DOWNLOAD SECTION (PRIMARY SOLUTION) */}
              <div className="p-4 bg-gradient-to-b from-indigo-950/50 via-blue-950/40 to-black/50 rounded-2xl border-2 border-indigo-500/50 space-y-3.5 shadow-2xl relative overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shrink-0 mt-0.5 shadow-md shadow-indigo-500/30">
                      <Smartphone className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <span>안드로이드 전용 APK 앱</span>
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black">
                          카톡처럼 닫아도 100% 알림
                        </span>
                      </div>
                      <p className="text-[11px] text-white/70 mt-1 leading-relaxed">
                        화면이 꺼지거나 앱을 완전히 닫아도 시스템 상단바와 잠금화면에 소리/진동과 함께 즉각 도착합니다.
                      </p>
                    </div>
                  </div>
                </div>

                {isNative ? (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span className="font-semibold">
                      현재 전용 APK 앱에서 접속 중입니다. 화면이 꺼져도 상단바 헤드업 알림이 정상 작동합니다.
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="text-xs">
                          <p className="font-bold text-white">JK-Messenger.apk (v1.0.0 정식 릴리즈)</p>
                          <p className="text-[10px] text-white/50">
                            크기: {apkInfo?.sizeMb || '17 KB'} · 안드로이드 7.0~15+ 호환
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setApkDownloaded(true);
                          downloadApkFile();
                        }}
                        className="py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold rounded-xl text-xs shadow-md shadow-indigo-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all shrink-0"
                      >
                        <Download className="w-4 h-4 animate-bounce" />
                        <span>APK 다운로드 (.apk)</span>
                      </button>
                    </div>

                    {apkDownloaded && (
                      <div className="p-2.5 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs flex items-center gap-2 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-blue-300 shrink-0" />
                        <span>APK 다운로드가 시작되었습니다! 다운로드 완료 후 파일을 터치하여 설치하세요.</span>
                      </div>
                    )}

                    {/* Expandable Why Web Fails Explanation */}
                    <div className="rounded-xl bg-white/[0.02] border border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowWebReason(!showWebReason)}
                        className="w-full px-3 py-2 flex items-center justify-between text-left text-xs hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-1.5 text-amber-300 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>웹 브라우저에서 웹소켓 알림이 안 울리는 이유 알아보기</span>
                        </div>
                        {showWebReason ? (
                          <ChevronUp className="w-3.5 h-3.5 text-white/40" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                        )}
                      </button>

                      {showWebReason && (
                        <div className="p-3 pt-1 border-t border-white/5 bg-black/30 space-y-2 text-[11px] text-white/70 leading-relaxed">
                          <p>
                            • <strong className="text-white">모바일 OS 배터리 절전(Doze Mode)</strong>: 스마트폰 화면이 꺼지거나 브라우저를 닫으면, 안드로이드/iOS 시스템이 배터리를 절약하기 위해 웹페이지의 WebSocket TCP 연결을 즉시 강제 종료(Freeze)합니다.
                          </p>
                          <p>
                            • <strong className="text-white">백그라운드 통신 차단</strong>: 브라우저가 최소화되면 자바스크립트 타이머와 수신 소켓이 잠에 빠지므로 서버에서 알림을 쏴도 브라우저에 도달하지 못합니다.
                          </p>
                          <p>
                            • <strong className="text-emerald-300 font-semibold">APK 전용 앱의 해결 원리</strong>: 이 APK는 안드로이드 Foreground Service와 고우선순위 NotificationChannel을 탑재하여 화면이 꺼져도 백그라운드에서 죽지 않고 메시지를 0.01초 만에 감지해 상단바와 잠금화면에 즉시 띄웁니다!
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* REAL SMARTPHONE OS PUSH NOTIFICATION SECTION */}
              <div className="p-4 bg-gradient-to-b from-blue-950/40 via-purple-950/20 to-black/40 rounded-2xl border border-blue-500/30 space-y-3.5 shadow-xl">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-white">
                          스마트폰 실제 기기(OS) 알림
                        </h4>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold">
                          앱 닫아도 수신됨
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60 mt-0.5 leading-relaxed">
                        화면이 꺼져있거나 홈 화면으로 나가있어도 스마트폰 상단바/잠금화면에 카카오톡처럼 실제 알림과 진동이 옵니다.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      {permStatus === 'granted' ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </>
                      ) : (
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                      )}
                    </span>
                    <span className="text-xs font-medium text-white/90">
                      {permStatus === 'granted'
                        ? '스마트폰 기기 알림 및 백그라운드 푸시 연동됨'
                        : '스마트폰 알림 권한 필요 (현재 꺼짐)'}
                    </span>
                  </div>

                  {permStatus !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleEnablePush}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>원클릭 알림 켜기</span>
                    </button>
                  )}
                </div>

                {/* Real Notification Test Action Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleImmediateOsTest}
                    className="py-2.5 px-3.5 bg-white/10 hover:bg-white/15 active:scale-[0.98] text-white font-semibold rounded-xl text-xs border border-white/15 flex items-center justify-center gap-2 transition-all shadow-sm"
                  >
                    <Smartphone className="w-4 h-4 text-blue-400" />
                    <span>지금 기기 알림 띄우기 (즉시)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDelayedPushTest}
                    disabled={countdown !== null}
                    className="py-2.5 px-3.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 active:scale-[0.98] text-white font-bold rounded-xl text-xs border border-white/20 flex items-center justify-center gap-2 transition-all shadow-md shadow-purple-600/25 disabled:opacity-50"
                  >
                    <Bell className="w-4 h-4 animate-bounce" />
                    <span>
                      {countdown !== null
                        ? `⏳ ${countdown}초 후 발송 (앱 닫으세요!)`
                        : '3초 뒤 푸시 발송 (앱 닫고 테스트)'}
                    </span>
                  </button>
                </div>

                {countdown !== null && (
                  <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-400/40 text-purple-200 text-xs flex items-center gap-2.5 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-purple-300" />
                    <span className="font-medium">
                      지금 메신저를 닫거나 홈 화면으로 나가보세요! {countdown}초 뒤 스마트폰 자체 알림이 도착합니다.
                    </span>
                  </div>
                )}

                {testStatus && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{testStatus}</span>
                  </div>
                )}
              </div>

              {/* In-app Top Banner Section (Clearly Labeled as In-App Only) */}
              <div className="p-3.5 bg-white/[0.02] rounded-xl border border-white/10 flex items-center justify-between text-xs">
                <div className="min-w-0 pr-3">
                  <span className="text-white/80 font-medium block">
                    앱 내부 화면 상단 알림 카드 (인앱 팝업)
                  </span>
                  <span className="text-[10px] text-white/40 block mt-0.5">
                    메신저 앱을 열어두고 다른 화면을 볼 때 화면 안에서 내려오는 보조 카드
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleTestHeadsUpBanner}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-[11px] font-semibold border border-white/10 shrink-0 transition-colors"
                >
                  인앱 카드 테스트
                </button>
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
