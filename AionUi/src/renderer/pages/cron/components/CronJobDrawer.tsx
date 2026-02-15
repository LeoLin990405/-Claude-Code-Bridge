/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ICronJob } from '@/common/ipcBridge';
import { Message } from '@arco-design/web-react';
import { AlarmClock, Trash2 } from 'lucide-react';
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Label } from '@/renderer/components/ui/label';
import { Switch } from '@/renderer/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/renderer/components/ui/sheet';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog';

interface CronJobDrawerProps {
  visible: boolean;
  job: ICronJob;
  onClose: () => void;
  onSave: (updates: { message: string; enabled: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}

const CronJobDrawer: React.FC<CronJobDrawerProps> = ({ visible, job, onClose, onSave, onDelete }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [enabled, setEnabled] = useState(job.enabled);
  const [command, setCommand] = useState(job.target.payload.text);

  // Parse initial values from job
  const initialValues = useMemo(() => {
    return {
      enabled: job.enabled,
      command: job.target.payload.text,
    };
  }, [job]);

  // Format next run time
  const nextRunTime = useMemo(() => {
    if (!job.state.nextRunAtMs) return null;
    return dayjs(job.state.nextRunAtMs).format('YYYY-MM-DD HH:mm');
  }, [job.state.nextRunAtMs]);

  // Reset form when job changes or drawer opens
  useEffect(() => {
    if (visible) {
      setEnabled(initialValues.enabled);
      setCommand(initialValues.command);
    }
  }, [visible, initialValues]);

  const handleSave = async () => {
    if (!command.trim()) {
      Message.error(t('cron.drawer.commandRequired'));
      return;
    }

    try {
      setSaving(true);
      await onSave({
        message: command,
        enabled: enabled,
      });
      Message.success(t('cron.drawer.saveSuccess'));
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        Message.error(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      Message.success(t('cron.deleteSuccess'));
      setShowDeleteConfirm(false);
      onClose();
    } catch (err) {
      Message.error(String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Sheet open={visible} onOpenChange={(open: boolean) => !open && onClose()}>
        <SheetContent className='w-[400px] sm:w-[400px]'>
          <SheetHeader>
            <SheetTitle className='flex items-center gap-2'>
              <AlarmClock size={18} />
              {t('cron.drawer.title')}
            </SheetTitle>
          </SheetHeader>

          <div className='mt-6 space-y-4'>
            {/* Name Section */}
            <div className='bg-muted rounded-lg px-4 py-4'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('cron.drawer.name')}</span>
                <span className='text-sm font-medium'>{job.name}</span>
              </div>
            </div>

            {/* Task Status Section */}
            <div className='bg-muted rounded-lg px-4 py-4'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('cron.drawer.taskStatus')}</span>
                <div className='flex items-center gap-2'>
                  <span className='text-sm text-muted-foreground'>{enabled ? t('cron.drawer.enabled') : t('cron.drawer.disabled')}</span>
                  <Switch checked={enabled} onCheckedChange={setEnabled} />
                </div>
              </div>
            </div>

            {/* Command Section */}
            <div className='bg-muted rounded-lg px-4 py-4'>
              <div className='space-y-2'>
                <Label htmlFor='command'>{t('cron.drawer.command')}</Label>
                <textarea id='command' value={command} onChange={(e) => setCommand(e.target.value)} placeholder={t('cron.drawer.commandPlaceholder')} className='w-full min-h-[80px] max-h-[200px] px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y' rows={3} />
              </div>
            </div>

            {/* Schedule Info Section */}
            <div className='bg-muted rounded-lg px-4 py-4 space-y-3'>
              <div className='flex items-center justify-between'>
                <span className='text-sm'>{t('cron.drawer.schedule')}</span>
                <span className='text-sm font-medium'>{job.schedule.description}</span>
              </div>
              {nextRunTime && (
                <div className='flex items-center justify-between'>
                  <span className='text-sm'>{t('cron.drawer.nextRun')}</span>
                  <span className='text-sm font-medium'>{nextRunTime}</span>
                </div>
              )}
            </div>
          </div>

          <SheetFooter className='mt-6 flex justify-between sm:justify-between'>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t('common.saving') : t('cron.drawer.save')}
            </Button>
            <Button variant='destructive' onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
              <Trash2 size={16} className='mr-2' />
              {t('cron.actions.delete')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cron.confirmDelete')}</DialogTitle>
            <DialogDescription>{t('cron.deleteDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowDeleteConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant='destructive' onClick={handleDelete} disabled={deleting}>
              {deleting ? t('common.deleting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CronJobDrawer;
