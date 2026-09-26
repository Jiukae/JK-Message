import React, { useState } from 'react';
import { User, UserStatusMode } from '../types';

interface UserAvatarProps {
  user?: Partial<User> | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'rounded-xl' | 'rounded-2xl' | 'rounded-full';
  showStatus?: boolean;
  statusMode?: UserStatusMode;
  className?: string;
  onClick?: () => void;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-2xl',
  xl: 'w-20 h-20 text-3xl',
};

const STATUS_DOT_CLASSES = {
  xs: 'w-2 h-2 -bottom-0.5 -right-0.5',
  sm: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
  md: 'w-3.5 h-3.5 -bottom-0.5 -right-0.5',
  lg: 'w-4 h-4 bottom-0 right-0',
  xl: 'w-5 h-5 bottom-0.5 right-0.5',
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  size = 'md',
  shape = 'rounded-2xl',
  showStatus = false,
  statusMode,
  className = '',
  onClick,
}) => {
  const [imageError, setImageError] = useState(false);

  const bgGradient = user?.avatarBg || 'from-blue-500 to-indigo-600';
  const emoji = user?.avatarEmoji || '👤';
  const hasValidImage = !!user?.avatarImage && !imageError;
  const currentStatus = statusMode || user?.status || 'offline';

  const getStatusColor = () => {
    switch (currentStatus) {
      case 'online':
        return 'bg-emerald-400 ring-emerald-400/30';
      case 'dnd':
        return 'bg-rose-500 ring-rose-500/30';
      default:
        return 'bg-white/30 ring-white/10';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <div
        className={`${SIZE_CLASSES[size]} ${shape} bg-gradient-to-tr ${bgGradient} border border-white/20 flex items-center justify-center shadow-md overflow-hidden relative transition-transform`}
      >
        {hasValidImage ? (
          <img
            src={user?.avatarImage!}
            alt={user?.name || 'User avatar'}
            onError={() => setImageError(true)}
            className="w-full h-full object-cover rounded-inherit"
          />
        ) : (
          <span className="flex items-center justify-center leading-none">{emoji}</span>
        )}
      </div>

      {showStatus && (
        <span
          className={`absolute rounded-full border-2 border-[#0c0e14] ring-1 shadow-sm ${STATUS_DOT_CLASSES[size]} ${getStatusColor()}`}
        />
      )}
    </div>
  );
};
