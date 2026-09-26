import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Smartphone, VolumeX, Check } from 'lucide-react';
import { NotificationMode } from '../types';
import { sounds } from '../utils/audio';

interface NotificationModeToggleProps {
  currentMode: NotificationMode;
  onModeChange: (mode: NotificationMode) => void;
  className?: string;
  compact?: boolean;
}

export const NotificationModeToggle: React.FC<NotificationModeToggleProps> = ({
  currentMode,
  onModeChange,
  className = '',
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const modes: {
    id: NotificationMode;
    label: string;
    description: string;
    icon: typeof Volume2;
    color: string;
    bgHover: string;
    activeBorder: string;
  }[] = [
    {
      id: 'sound',
      label: '소리',
      description: '소리("띠링~") + 진동',
      icon: Volume2,
      color: 'text-blue-400',
      bgHover: 'hover:bg-blue-500/10',
      activeBorder: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
    },
    {
      id: 'vibrate',
      label: '진동',
      description: '소리 없이 진동만',
      icon: Smartphone,
      color: 'text-amber-400',
      bgHover: 'hover:bg-amber-500/10',
      activeBorder: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
    },
    {
      id: 'silent',
      label: '무음',
      description: '소리 및 진동 끔 (화면 알림만)',
      icon: VolumeX,
      color: 'text-purple-400',
      bgHover: 'hover:bg-purple-500/10',
      activeBorder: 'border-purple-500/40 bg-purple-500/15 text-purple-300',
    },
  ];

  const activeModeObj = modes.find((m) => m.id === currentMode) || modes[0];
  const ActiveIcon = activeModeObj.icon;

  const handleSelect = (mode: NotificationMode) => {
    onModeChange(mode);
    sounds.setNotificationMode(mode);
    if (mode === 'sound') {
      sounds.testSound();
    } else if (mode === 'vibrate') {
      sounds.triggerHaptic([180, 80, 200]);
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all select-none ${
          currentMode === 'sound'
            ? 'bg-blue-600/15 border-blue-500/30 text-blue-300 hover:bg-blue-600/25'
            : currentMode === 'vibrate'
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
            : 'bg-white/10 border-white/15 text-white/70 hover:bg-white/15'
        }`}
        title={`알림 모드 변경 (현재: ${activeModeObj.label})`}
      >
        <ActiveIcon className="w-3.5 h-3.5 shrink-0" />
        {!compact && <span className="text-xs font-semibold">{activeModeObj.label}</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-52 p-1.5 bg-[#141624]/95 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1 mb-1 border-b border-white/10">
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
              알림 모드 선택
            </span>
          </div>

          <div className="space-y-1">
            {modes.map((m) => {
              const Icon = m.icon;
              const isSelected = currentMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelect(m.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-left transition-all ${
                    isSelected ? m.activeBorder : `text-white/80 ${m.bgHover}`
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${m.color}`} />
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-none">{m.label}</div>
                      <div className="text-[10px] text-white/50 leading-tight mt-0.5 truncate">
                        {m.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-white ml-2" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
