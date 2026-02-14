/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import { ConfigStorage } from '@/common/storage';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { useThemeContext } from '@/renderer/context/ThemeContext';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { toast } from 'sonner';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { useSettingsViewMode } from '../settingsViewContext';

interface GeminiModalContentProps {
  /** 请求关闭设置弹窗 / Request closing the settings modal */
  onRequestClose?: () => void;
}

const GeminiModalContent: React.FC<GeminiModalContentProps> = ({ onRequestClose }) => {
  const { t } = useTranslation();
  const { theme: _theme } = useThemeContext();
  const [loading, setLoading] = useState(false);
  const [googleAccountLoading, setGoogleAccountLoading] = useState(false);
  const [userLoggedOut, setUserLoggedOut] = useState(false);
  const [currentAccountEmail, setCurrentAccountEmail] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    googleAccount: '',
    proxy: '',
    GOOGLE_CLOUD_PROJECT: '',
    customCss: '',
  });
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  /**
   * 加载当前账号对应的 GOOGLE_CLOUD_PROJECT
   * Load GOOGLE_CLOUD_PROJECT for current account
   */
  const loadAccountProject = async (email: string, geminiConfig: Record<string, unknown>) => {
    const accountProjects = (geminiConfig?.accountProjects as Record<string, string>) || {};
    const projectId = accountProjects[email];

    // 清理旧的全局配置（不自动迁移，因为可能属于其他账号）
    // Clean up old global config (don't auto-migrate, it might belong to another account)
    if (geminiConfig?.GOOGLE_CLOUD_PROJECT) {
      const { GOOGLE_CLOUD_PROJECT: _, ...restConfig } = geminiConfig;
      await ConfigStorage.set('gemini.config', {
        ...restConfig,
        accountProjects: Object.keys(accountProjects).length > 0 ? accountProjects : undefined,
      } as Parameters<typeof ConfigStorage.set<'gemini.config'>>[1]);
    }

    setFormData((prev) => ({ ...prev, GOOGLE_CLOUD_PROJECT: projectId || '' }));
  };

  const loadGoogleAuthStatus = (proxy?: string, geminiConfig?: Record<string, unknown>) => {
    setGoogleAccountLoading(true);
    ipcBridge.googleAuth.status
      .invoke({ proxy: proxy })
      .then((data) => {
        if (data.success && data.data?.account) {
          const email = data.data.account;
          setFormData((prev) => ({ ...prev, googleAccount: email }));
          setCurrentAccountEmail(email);
          setUserLoggedOut(false);
          // 加载该账号的项目配置 / Load project config for this account
          if (geminiConfig) {
            void loadAccountProject(email, geminiConfig);
          }
        } else if (data.success === false && (!data.msg || userLoggedOut)) {
          setFormData((prev) => ({ ...prev, googleAccount: '' }));
          setCurrentAccountEmail(null);
        }
      })
      .catch((error) => {
        console.warn('Failed to check Google auth status:', error);
      })
      .finally(() => {
        setGoogleAccountLoading(false);
      });
  };

  const onSubmit = async () => {
    try {
      // Validate proxy format if provided
      if (formData.proxy && !/^https?:\/\/.+$/.test(formData.proxy)) {
        toast.error(t('settings.proxyHttpOnly'));
        return;
      }

      const { googleAccount: _googleAccount, customCss, GOOGLE_CLOUD_PROJECT, ...restConfig } = formData;
      setLoading(true);

      // 获取现有配置 / Get existing config
      const existingConfig = ((await ConfigStorage.get('gemini.config')) || {}) as Record<string, unknown>;
      const accountProjects = (existingConfig.accountProjects as Record<string, string>) || {};

      // 如果有当前账号，将项目 ID 存储到 accountProjects
      // If logged in, store project ID to accountProjects
      if (currentAccountEmail && GOOGLE_CLOUD_PROJECT) {
        accountProjects[currentAccountEmail] = GOOGLE_CLOUD_PROJECT;
      } else if (currentAccountEmail && !GOOGLE_CLOUD_PROJECT) {
        // 清空当前账号的项目配置 / Clear project config for current account
        delete accountProjects[currentAccountEmail];
      }

      const geminiConfig = {
        ...restConfig,
        accountProjects: Object.keys(accountProjects).length > 0 ? accountProjects : undefined,
        // 不再保存顶层的 GOOGLE_CLOUD_PROJECT / No longer save top-level GOOGLE_CLOUD_PROJECT
      };

      await ConfigStorage.set('gemini.config', geminiConfig);
      await ConfigStorage.set('customCss', customCss || '');

      toast.success(t('common.saveSuccess'));
      onRequestClose?.();

      window.dispatchEvent(
        new CustomEvent('custom-css-updated', {
          detail: { customCss: customCss || '' },
        })
      );
    } catch (error: unknown) {
      toast.error((error as Error)?.message || t('common.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onRequestClose?.();
  };

  useEffect(() => {
    Promise.all([ConfigStorage.get('gemini.config'), ConfigStorage.get('customCss')])
      .then(([geminiConfig, customCss]) => {
        setFormData({
          ...geminiConfig,
          customCss: customCss || '',
          googleAccount: '',
          proxy: geminiConfig?.proxy || '',
          GOOGLE_CLOUD_PROJECT: '',
        });
        loadGoogleAuthStatus(geminiConfig?.proxy, geminiConfig);
      })
      .catch((error) => {
        console.error('Failed to load configuration:', error);
      });
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className='flex flex-col h-full w-full'>
      {/* Content Area */}
      <AionScrollArea className='flex-1 min-h-0' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          <div className='px-[12px] py-[24px] md:px-[32px] bg-2 rd-12px md:rd-16px border border-border-2'>
            <div className='space-y-20px'>
              {/* Personal Auth Section */}
              <div className='flex flex-col md:flex-row md:items-center gap-12px'>
                <label className='text-sm font-medium min-w-[140px] text-t-primary'>{t('settings.personalAuth')}</label>
                <div
                  className={classNames('flex flex-wrap items-center justify-end gap-12px flex-1', {
                    'mt-12px w-full justify-start md:mt-0 md:w-auto md:justify-end': isPageMode,
                  })}
                >
                  {formData.googleAccount ? (
                    <>
                      <span className='text-14px text-t-primary'>{formData.googleAccount}</span>
                      <Button
                        variant='outline'
                        size='sm'
                        className='rounded-full border-[#86909C]'
                        onClick={() => {
                          setUserLoggedOut(true);
                          ipcBridge.googleAuth.logout
                            .invoke({})
                            .then(() => {
                              setFormData((prev) => ({ ...prev, googleAccount: '' }));
                            })
                            .catch((error) => {
                              console.error('Failed to logout from Google:', error);
                            });
                        }}
                      >
                        {t('settings.googleLogout')}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size='sm'
                      disabled={googleAccountLoading}
                      className='rounded-full'
                      onClick={() => {
                        setGoogleAccountLoading(true);
                        ipcBridge.googleAuth.login
                          .invoke({ proxy: formData.proxy })
                          .then((result) => {
                            if (result.success) {
                              loadGoogleAuthStatus(formData.proxy);
                              if (result.data?.account) {
                                toast.success(t('settings.googleLoginSuccess', { defaultValue: 'Successfully logged in' }));
                              }
                            } else {
                              // 登录失败，显示错误消息
                              // Login failed, show error message
                              const errorMsg = result.msg || t('settings.googleLoginFailed', { defaultValue: 'Login failed. Please try again.' });
                              toast.error(errorMsg);
                              console.error('[GoogleAuth] Login failed:', result.msg);
                            }
                          })
                          .catch((error) => {
                            toast.error(t('settings.googleLoginFailed', { defaultValue: 'Login failed. Please try again.' }));
                            console.error('Failed to login to Google:', error);
                          })
                          .finally(() => {
                            setGoogleAccountLoading(false);
                          });
                      }}
                    >
                      {googleAccountLoading ? t('common.loading') : t('settings.googleLogin')}
                    </Button>
                  )}
                </div>
              </div>

              <hr className='border-border-2' />

              {/* Proxy Config Section */}
              <div className='space-y-8px'>
                <label className='text-sm font-medium text-t-primary block'>{t('settings.proxyConfig')}</label>
                <Input
                  className='aion-input'
                  placeholder={t('settings.proxyHttpOnly')}
                  value={formData.proxy}
                  onChange={(e) => handleInputChange('proxy', e.target.value)}
                />
              </div>

              <hr className='border-border-2' />

              {/* GOOGLE_CLOUD_PROJECT Section */}
              <div className='space-y-8px'>
                <label className='text-sm font-medium text-t-primary block'>GOOGLE_CLOUD_PROJECT</label>
                <Input
                  className='aion-input'
                  placeholder={t('settings.googleCloudProjectPlaceholder')}
                  value={formData.GOOGLE_CLOUD_PROJECT}
                  onChange={(e) => handleInputChange('GOOGLE_CLOUD_PROJECT', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </AionScrollArea>

      {/* Footer with Buttons */}
      <div className={classNames('flex-shrink-0 flex gap-10px border-t border-border-2 pl-24px py-16px', isPageMode ? 'border-none pl-0 pr-0 pt-10px flex-col md:flex-row md:justify-end' : 'justify-end')}>
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

export default GeminiModalContent;
