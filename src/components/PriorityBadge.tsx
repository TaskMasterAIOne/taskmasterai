
import React from 'react';
import { Flag } from 'lucide-react';

interface PriorityBadgeProps {
  priority: 'high' | 'medium' | 'low';
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({
  priority,
  className = ''
}) => {
  let bgColor = '';
  let textColor = '';
  let iconColor = '';

  switch (priority) {
    case 'high':
      bgColor = 'bg-red-100 dark:bg-red-500/20';
      textColor = 'text-red-700 dark:text-red-400';
      iconColor = 'text-red-500 dark:text-red-300';
      break;
    case 'medium':
      bgColor = 'bg-orange-100 dark:bg-orange-500/20';
      textColor = 'text-orange-700 dark:text-orange-400';
      iconColor = 'text-orange-500 dark:text-orange-300';
      break;
    case 'low':
      bgColor = 'bg-green-100 dark:bg-green-500/20';
      textColor = 'text-green-700 dark:text-green-400';
      iconColor = 'text-green-500 dark:text-green-300';
      break;
  }

  return (
    <span className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 ${bgColor} ${textColor} ${className}`}>
      <Flag className={`w-3.5 h-3.5 ${iconColor}`} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
};
