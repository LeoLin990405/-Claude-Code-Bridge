/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { iconColors } from '@/renderer/theme/colors';
import { emitter } from '@/renderer/utils/emitter';
import { AlarmClock } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/renderer/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/renderer/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/renderer/components/ui/tooltip';
import { useCronJobs } from '../hooks/useCronJobs';
import { getJobStatusFlags } from '../utils/cronUtils';
import CronJobDrawer from './CronJobDrawer';

interface CronJobManagerProps {
  conversationId: string;
}

/**
 * Cron job manager component for ChatLayout headerExtra
 * Shows a single job per conversation with drawer for editing
 */
const CronJobManager: React.FC<CronJobManagerProps> = ({ conversationId }) => {
  const { t } = useTranslation();
  const { jobs, loading, hasJobs, deleteJob, updateJob } = useCronJobs(conversationId);
  const [drawerVisible, setDrawerVisible] = useState(false);

  // Handle unconfigured state (no jobs)
  if (!hasJobs && !loading) {
    const handleCreateClick = () => {
      emitter.emit('sendbox.fill', t('cron.status.defaultPrompt'));
    };

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant='ghost' size='icon' className='h-8 w-8 mr-4'>
            <span className='inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 bg-muted'>
              <AlarmClock size={16} className='text-muted-foreground' />
              <span className='ml-1 w-2 h-2 rounded-full bg-gray-400' />
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-60'>
          <div className='flex flex-col gap-2'>
            <p className='text-sm text-muted-foreground'>{t('cron.status.unconfiguredHint')}</p>
            <Button size='sm' onClick={handleCreateClick} className='w-full'>
              {t('cron.status.createNow')}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // Get the single job (assuming one job per conversation)
  const job = jobs[0];
  if (!job) return null;

  const { hasError, isPaused } = getJobStatusFlags(job);

  const tooltipContent = isPaused ? t('cron.status.paused') : hasError ? t('cron.status.error') : job.name;

  const handleSave = async (updates: { message: string; enabled: boolean }) => {
    await updateJob(job.id, {
      enabled: updates.enabled,
      target: { payload: { kind: 'message', text: updates.message } },
    });
  };

  const handleDelete = async () => {
    await deleteJob(job.id);
  };

  const getStatusColor = () => {
    if (hasError) return 'bg-red-500';
    if (isPaused) return 'bg-orange-500';
    return 'bg-green-500';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant='ghost' size='icon' className='h-8 w-8 mr-4' onClick={() => setDrawerVisible(true)}>
            <span className='inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 bg-muted'>
              <AlarmClock size={16} className='text-primary' />
              <span className={`ml-1 w-2 h-2 rounded-full ${getStatusColor()}`} />
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
      <CronJobDrawer visible={drawerVisible} job={job} onClose={() => setDrawerVisible(false)} onSave={handleSave} onDelete={handleDelete} />
    </TooltipProvider>
  );
};

export default CronJobManager;
