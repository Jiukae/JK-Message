import React from 'react';
import { Crown, Sparkles, Award } from 'lucide-react';

interface TitleBadgeProps {
  title: string;
  size?: 'xs' | 'sm' | 'md';
  showTooltip?: boolean;
  className?: string;
}

export const TitleBadge: React.FC<TitleBadgeProps> = ({
  title,
  size = 'sm',
  showTooltip = true,
  className = '',
}) => {
  if (!title) return null;

  const isShareKing = title === '공유왕';
  const isSocialButterfly = title === '인싸';

  // Size styling
  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.2 rounded-md gap-0.5 font-medium',
    sm: 'text-[10px] px-2 py-0.5 rounded-lg gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 rounded-xl gap-1.5 font-bold',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  // Specific theme per title
  let badgeClasses = 'bg-blue-500/20 text-blue-300 border border-blue-500/30';
  let IconComponent = Award;
  let tooltipText = `칭호: ${title}`;

  if (isShareKing) {
    badgeClasses =
      'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-600/25 text-amber-200 border border-amber-400/40 shadow-sm shadow-amber-500/20';
    IconComponent = Crown;
    tooltipText = '👑 공유왕: 친구에게 JK Message를 공유하여 획득한 영광의 칭호';
  } else if (isSocialButterfly) {
    badgeClasses =
      'bg-gradient-to-r from-purple-500/25 via-fuchsia-500/20 to-pink-500/25 text-purple-200 border border-purple-400/40 shadow-sm shadow-purple-500/20';
    IconComponent = Sparkles;
    tooltipText = '✨ 인싸: 친구를 10명 이상 등록하여 획득한 슈퍼 인싸 칭호';
  }

  return (
    <span
      className={`inline-flex items-center shrink-0 tracking-wide select-none backdrop-blur-md transition-all ${sizeClasses} ${badgeClasses} ${className}`}
      title={showTooltip ? tooltipText : undefined}
    >
      <IconComponent className={`${iconSizes} shrink-0`} />
      <span>{title}</span>
    </span>
  );
};
