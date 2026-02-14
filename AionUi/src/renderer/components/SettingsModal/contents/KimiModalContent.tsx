/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConfigStorage } from '@/common/storage';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { useThemeContext } from '@/renderer/context/ThemeContext';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { useSettingsViewMode } from '../settingsViewContext';
import { ipcBridge } from '@/common';

interface KimiModalContentProps {
  /** 请求关闭设置弹窗 / Request closing the settings modal */
  onRequestClose?: () => void;
}

const KimiModalContent: React.FC<KimiModalContentProps> = ({ onRequestClose }) => {
  const { t } = useTranslation();
  const { theme: _theme } = useThemeContext();
  const [loading, setLoading] = useState(false);
  const [healthCheckStatus, setHealthCheckStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-thinking' as 'kimi-normal' | 'kimi-thinking',
    cliPath: '',
  });
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  useEffect(() => {
    ConfigStorage.get('kimi.config')
      .then((kimiConfig) => {
        if (kimiConfig) {
          setFormData({
            apiKey: kimiConfig.apiKey || '',
            baseUrl: kimiConfig.baseUrl || 'https://api.moonshot.cn/v1',
            model: kimiConfig.model || 'kimi-thinking',
            cliPath: kimiConfig.cliPath || '',
          });
        }
      })
      .catch((error) => {
        console.error('Failed to load Kimi configuration:', error);
      });
  }, []);

  const handleHealthCheck = async () => {
    setHealthCheckStatus('checking');
    try {
      const result = await ipcBridge.acpConversation.checkAgentHealth.invoke({
        backend: 'kimi',
      });

      if (result.success && result.data?.available) {
        setHealthCheckStatus('success');
        toast.success(t('settings.kimiHealthCheckSuccess'));
      } else {
        setHealthCheckStatus('error');
        toast.error(result.msg || t('settings.kimiHealthCheckFailed'));
      }
    } catch (error) {
      setHealthCheckStatus('error');
      toast.error(t('settings.kimiHealthCheckFailed'));
    }
  };

  const onSubmit = async () => {
    try {
      setLoading(true);

      const kimiConfig = {
        apiKey: formData.apiKey || undefined,
        baseUrl: formData.baseUrl || undefined,
        model: formData.model,
        cliPath: formData.cliPath || undefined,
      };

      await ConfigStorage.set('kimi.config', kimiConfig);

      toast.success(t('common.saveSuccess'));
      onRequestClose?.();
    } catch (error: unknown) {
      toast.error((error as Error)?.message || t('common.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onRequestClose?.();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Content Area */}
      <AionScrollArea className="flex-1 min-h-0" disableOverflow={isPageMode}>
        <div className="space-y-16px">
          <div className="px-[12px] py-[24px] md:px-[32px] bg-2 rd-12px md:rd-16px border border-border-2">
            <div className="space-y-20px">
              {/* API Key Section */}
              <div className="space-y-8px">
                <label className="text-sm font-medium text-t-primary block">{t('settings.kimiApiKey')}</label>
                <Input
                  className="aion-input"
                  type="password"
                  placeholder={t('settings.kimiApiKeyPlaceholder')}
                  value={formData.apiKey}
                  onChange={(e) => handleInputChange('apiKey', e.target.value)}
                />
                <p className="text-12px text-t-tertiary">{t('settings.kimiApiKeyDescription')}</p>
              </div>

              <hr className="border-border-2" />

              {/* Base URL Section */}
              <div className="space-y-8px">
                <label className="text-sm font-medium text-t-primary block">{t('settings.kimiBaseUrl')}</label>
                <Select value={formData.baseUrl} onValueChange={(value) => handleInputChange('baseUrl', value)}>
                  <SelectTrigger className="aion-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="https://api.moonshot.cn/v1">Moonshot China (api.moonshot.cn)</SelectItem>
                    <SelectItem value="https://api.moonshot.ai/v1">Moonshot Global (api.moonshot.ai)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <hr className="border-border-2" />

              {/* Model Selection */}
              <div className="space-y-8px">
                <label className="text-sm font-medium text-t-primary block">{t('settings.kimiModel')}</label>
                <Select value={formData.model} onValueChange={(value: 'kimi-normal' | 'kimi-thinking') => handleInputChange('model', value)}>
                  <SelectTrigger className="aion-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kimi-normal">
                      <div className="flex flex-col">
                        <span>Kimi - {t('settings.kimiNormalMode')}</span>
                        <span className="text-12px text-t-tertiary">{t('settings.kimiNormalModeDesc')}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="kimi-thinking">
                      <div className="flex flex-col">
                        <span>Kimi - {t('settings.kimiThinkingMode')}</span>
                        <span className="text-12px text-t-tertiary">{t('settings.kimiThinkingModeDesc')}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <hr className="border-border-2" />

              {/* CLI Path Section */}
              <div className="space-y-8px">
                <label className="text-sm font-medium text-t-primary block">{t('settings.kimiCliPath')}</label>
                <Input className="aion-input" placeholder={t('settings.kimiCliPathPlaceholder')} value={formData.cliPath} onChange={(e) => handleInputChange('cliPath', e.target.value)} />
                <p className="text-12px text-t-tertiary">{t('settings.kimiCliPathDescription')}</p>
              </div>

              <hr className="border-border-2" />

              {/* Health Check Section */}
              <div className="space-y-8px">
                <label className="text-sm font-medium text-t-primary block">{t('settings.kimiHealthCheck')}</label>
                <div className="flex gap-12px items-center">
                  <Button variant="outline" size="sm" className="rounded-full" onClick={handleHealthCheck} disabled={healthCheckStatus === 'checking'}>
                    {healthCheckStatus === 'checking' ? t('common.checking') : t('settings.kimiCheckConnection')}
                  </Button>
                  {healthCheckStatus === 'success' && <span className="text-green-500">✓ {t('settings.kimiConnectionSuccess')}</span>}
                  {healthCheckStatus === 'error' && <span className="text-red-500">✗ {t('settings.kimiConnectionFailed')}</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </AionScrollArea>

      {/* Footer with Buttons */}
      <div className={classNames('flex-shrink-0 flex gap-10px border-t border-border-2 pl-24px py-16px', isPageMode ? 'border-none pl-0 pr-0 pt-10px flex-col md:flex-row md:justify-end' : 'justify-end')}>
        <Button variant="outline" className={classNames('rounded-full', isPageMode && 'w-full md:w-auto')} onClick={handleCancel}>
          {t('common.cancel')}
        </Button>
        <Button disabled={loading} onClick={onSubmit} className={classNames('rounded-full', isPageMode && 'w-full md:w-auto')}>
          {loading ? t('common.saving') : t('common.save')}
        </Button>
      </div>
    </div>
  );
};

export default KimiModalContent;
