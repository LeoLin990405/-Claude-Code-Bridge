/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import LanguageSwitcher from '@/renderer/components/LanguageSwitcher';
import { iconColors } from '@/renderer/theme/colors';
import { Button } from '@/renderer/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/renderer/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/renderer/components/ui/tooltip';
import { Alert, AlertDescription } from '@/renderer/components/ui/alert';
import { FolderOpen } from '@icon-park/react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import classNames from 'classnames';
import { useSettingsViewMode } from '../settingsViewContext';

/**
 * 目录选择输入组件 / Directory selection input component
 * 用于选择和显示系统目录路径 / Used for selecting and displaying system directory paths
 */
const DirInputItem: React.FC<{
  /** 标签文本 / Label text */
  label: string;
  /** 表单字段名 / Form field name */
  field: string;
  /** 当前值 / Current value */
  value: string;
  /** 值变更回调 / Value change callback */
  onChange: (value: string) => void;
}> = ({ label, field, value, onChange }) => {
  const { t } = useTranslation();

  const handlePick = () => {
    ipcBridge.dialog.showOpen
      .invoke({
        defaultPath: value,
        properties: ['openDirectory', 'createDirectory'],
      })
      .then((data) => {
        if (data?.[0]) {
          onChange(data[0]);
        }
      })
      .catch((error) => {
        console.error('Failed to open directory dialog:', error);
      });
  };

  return (
    <div className='flex flex-col gap-8px'>
      <label className='text-sm font-medium text-t-primary'>{label}</label>
      <div className='aion-dir-input h-[32px] flex items-center rounded-8px border border-solid border-transparent pl-14px bg-[var(--fill-0)]'>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className='flex-1 min-w-0 text-13px text-t-primary truncate'>{value || t('settings.dirNotConfigured')}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{value || t('settings.dirNotConfigured')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-l-none border-l border-border'
          style={{ borderRadius: '0 8px 8px 0' }}
          onClick={(e) => {
            e.stopPropagation();
            handlePick();
          }}
        >
          <FolderOpen theme='outline' size='18' fill={iconColors.primary} />
        </Button>
      </div>
    </div>
  );
};

/**
 * 偏好设置行组件 / Preference row component
 * 用于显示标签和对应的控件，统一的水平布局 / Used for displaying labels and corresponding controls in a unified horizontal layout
 */
const PreferenceRow: React.FC<{
  /** 标签文本 / Label text */
  label: string;
  /** 控件元素 / Control element */
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className='flex items-center justify-between gap-24px py-12px'>
    <div className='text-14px text-2'>{label}</div>
    <div className='flex-1 flex justify-end'>{children}</div>
  </div>
);

/**
 * 系统设置内容组件 / System settings content component
 *
 * 提供系统级配置选项，包括语言和目录配置
 * Provides system-level configuration options including language and directory config
 *
 * @features
 * - 语言设置 / Language setting
 * - 高级设置：缓存目录、工作目录配置 / Advanced: cache directory, work directory configuration
 * - 配置变更自动保存 / Auto-save on configuration changes
 */
interface SystemModalContentProps {
  /** 关闭设置弹窗 / Close settings modal */
  onRequestClose?: () => void;
}

const SystemModalContent: React.FC<SystemModalContentProps> = ({ onRequestClose }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmResolve, setConfirmResolve] = useState<((value: boolean) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  // Form data
  const [formData, setFormData] = useState({
    cacheDir: '',
    workDir: '',
  });

  // Get system directory info
  const { data: systemInfo } = useSWR('system.dir.info', () => ipcBridge.application.systemInfo.invoke());

  // Initialize form data
  useEffect(() => {
    if (systemInfo) {
      setFormData({
        cacheDir: systemInfo.cacheDir || '',
        workDir: systemInfo.workDir || '',
      });
    }
  }, [systemInfo]);

  // 偏好设置项配置 / Preference items configuration
  const preferenceItems = [{ key: 'language', label: t('settings.language'), component: <LanguageSwitcher /> }];

  // 目录配置保存确认 / Directory configuration save confirmation
  const saveDirConfigValidate = (): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmResolve(() => resolve);
      setConfirmDialogOpen(true);
    });
  };

  const handleConfirm = () => {
    setConfirmDialogOpen(false);
    confirmResolve?.(true);
    setConfirmResolve(null);
  };

  const handleCancelConfirm = () => {
    setConfirmDialogOpen(false);
    confirmResolve?.(false);
    setConfirmResolve(null);
  };

  /**
   * 保存目录配置 / Save directory configuration
   * 如果目录发生变更，会提示用户确认并重启应用
   * If directories are changed, will prompt user for confirmation and restart the app
   */
  const onSubmit = async () => {
    let shouldClose = false;
    try {
      const { cacheDir, workDir } = formData;
      setLoading(true);
      setError(null);

      // 检查目录是否被修改 / Check if directories are modified
      const needsRestart = cacheDir !== systemInfo?.cacheDir || workDir !== systemInfo?.workDir;

      if (needsRestart) {
        const confirmed = await saveDirConfigValidate();
        if (confirmed) {
          const result = await ipcBridge.application.updateSystemInfo.invoke({ cacheDir, workDir });
          if (result.success) {
            await ipcBridge.application.restart.invoke();
            shouldClose = true;
          } else {
            setError(result.msg || 'Failed to update system info');
          }
        }
      } else {
        shouldClose = true;
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setLoading(false);
      if (shouldClose) {
        onRequestClose?.();
      }
    }
  };

  // 重置表单到初始值 / Reset form to initial values
  const onReset = () => {
    if (systemInfo) {
      setFormData({
        cacheDir: systemInfo.cacheDir || '',
        workDir: systemInfo.workDir || '',
      });
    }
    setError(null);
  };

  const handleCancel = () => {
    onReset();
    onRequestClose?.();
  };

  const handleDirChange = (field: 'cacheDir' | 'workDir', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className='flex flex-col h-full w-full'>
      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('settings.updateConfirm')}</DialogTitle>
            <DialogDescription>{t('settings.restartConfirm')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={handleCancelConfirm}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirm}>{t('common.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 内容区域 / Content Area */}
      <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          {/* 偏好设置与高级设置合并展示 / Combined preferences and advanced settings */}
          <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-12px'>
            <div className='w-full flex flex-col divide-y divide-border-2'>
              {preferenceItems.map((item) => (
                <PreferenceRow key={item.key} label={item.label}>
                  {item.component}
                </PreferenceRow>
              ))}
            </div>
            <div className='space-y-16px'>
              <DirInputItem
                label={t('settings.cacheDir')}
                field='cacheDir'
                value={formData.cacheDir}
                onChange={(value) => handleDirChange('cacheDir', value)}
              />
              <DirInputItem
                label={t('settings.workDir')}
                field='workDir'
                value={formData.workDir}
                onChange={(value) => handleDirChange('workDir', value)}
              />
              {error && (
                <Alert variant='destructive'>
                  <AlertDescription>{typeof error === 'string' ? error : JSON.stringify(error)}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>
      </AionScrollArea>

      {/* 底部操作栏 / Footer with action buttons */}
      <div className={classNames('flex-shrink-0 flex gap-10px border-t border-border-2 px-24px pt-10px', isPageMode ? 'border-none px-0 pt-10px flex-col md:flex-row md:justify-end' : 'justify-end')}>
        <Button variant='outline' className={classNames('rounded-full', isPageMode && 'w-full md:w-auto')} onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={loading} onClick={onSubmit} className={classNames('rounded-full', isPageMode && 'w-full md:w-auto')}>
          {loading ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default SystemModalContent;
