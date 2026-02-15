/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconColors } from '@/renderer/theme/colors';
import { AlarmClock, AlertCircle, PauseCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip';

export type CronJobStatus = 'none' | 'active' | 'paused' | 'error' | 'unread' | 'unconfigured';

interface CronJobIndicatorProps {
  status: CronJobStatus;
  size?: number;
  className?: string;
}

/**
 * Simple indicator icon for conversations with cron jobs
 * Used in ChatHistory to distinguish conversations with scheduled tasks
 */
const CronJobIndicator: React.FC<CronJobIndicatorProps> = ({ status, size = 14, className = '' }) => {
  const { t } = useTranslation();

  if (status === 'none') {
    return null;
  }

  const getIcon = () => {
    const iconSize = size;
    switch (status) {
      case 'unread':
        // Show alarm clock with red dot overlay for unread executions
        return (
          <span className='relative inline-flex'>
            <AlarmClock size={iconSize} className='flex items-center' />
            <span
              className='absolute rounded-full bg-red-500'
              style={{
                width: Math.max(6, size * 0.4),
                height: Math.max(6, size * 0.4),
                top: -1,
                right: -1,
              }}
            />
          </span>
        );
      case 'active':
        return <AlarmClock size={iconSize} className='flex items-center' />;
      case 'paused':
        return <PauseCircle size={iconSize} className='flex items-center' />;
      case 'error':
        return <AlertCircle size={iconSize} className='flex items-center text-red-500' />;
      case 'unconfigured':
        return <AlarmClock size={iconSize} className='flex items-center text-muted-foreground' />;
      default:
        return null;
    }
  };

  const getTooltip = () => {
    switch (status) {
      case 'unread':
        return t('cron.status.unread');
      case 'active':
        return t('cron.status.active');
      case 'paused':
        return t('cron.status.paused');
      case 'error':
        return t('cron.status.error');
      case 'unconfigured':
        return t('cron.status.unconfigured');
      default:
        return '';
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center justify-center ${className}`}>{getIcon()}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltip()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default CronJobIndicator;
