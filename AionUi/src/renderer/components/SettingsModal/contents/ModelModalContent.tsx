/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import type { IProvider } from '@/common/storage';
import { Button } from '@/renderer/components/ui/button';
import { Badge } from '@/renderer/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/renderer/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/renderer/components/ui/alert-dialog';
import { toast } from 'sonner';
import { DeleteFour, Info, Minus, Plus, Write } from '@icon-park/react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';
import AddModelModal from '@/renderer/pages/settings/components/AddModelModal';
import AddPlatformModal from '@/renderer/pages/settings/components/AddPlatformModal';
import { isNewApiPlatform, NEW_API_PROTOCOL_OPTIONS } from '@/renderer/config/modelPlatforms';
import EditModeModal from '@/renderer/pages/settings/components/EditModeModal';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { useSettingsViewMode } from '../settingsViewContext';

/**
 * 获取协议显示标签颜色
 * Get protocol badge color
 */
const getProtocolColor = (protocol: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (protocol) {
    case 'gemini':
      return 'default';
    case 'anthropic':
      return 'destructive';
    case 'openai':
    default:
      return 'secondary';
  }
};

/**
 * 获取协议显示名称
 * Get protocol display name
 */
const getProtocolLabel = (protocol: string): string => {
  return NEW_API_PROTOCOL_OPTIONS.find((p) => p.value === protocol)?.label || 'OpenAI';
};

/**
 * 获取下一个协议（循环切换）
 * Get next protocol (cycle through options)
 */
const getNextProtocol = (current: string): string => {
  const idx = NEW_API_PROTOCOL_OPTIONS.findIndex((p) => p.value === current);
  const nextIdx = (idx + 1) % NEW_API_PROTOCOL_OPTIONS.length;
  return NEW_API_PROTOCOL_OPTIONS[nextIdx].value;
};

// Calculate API Key count
const getApiKeyCount = (apiKey: string): number => {
  if (!apiKey) return 0;
  return apiKey.split(/[,\n]/).filter((k) => k.trim().length > 0).length;
};

const ModelModalContent: React.FC = () => {
  const { t } = useTranslation();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';
  const [cacheKey, setCacheKey] = useState('model.config');
  const [collapseKey, setCollapseKey] = useState<Record<string, boolean>>({});
  const { data } = useSWR(cacheKey, () => {
    return ipcBridge.mode.getModelConfig.invoke().then((data) => {
      if (!data) return [];
      return data;
    });
  });

  const saveModelConfig = (newData: IProvider[], success?: () => void) => {
    ipcBridge.mode.saveModelConfig
      .invoke(newData)
      .then((data) => {
        if (data.success) {
          setCacheKey('model.config' + Date.now());
          success?.();
        } else {
          toast.error(data.msg);
        }
      })
      .catch((error) => {
        console.error('Failed to save model config:', error);
        toast.error(t('settings.saveModelConfigFailed'));
      });
  };

  const updatePlatform = (platform: IProvider, success: () => void) => {
    const newData = [...(data || [])];
    const originData = newData.find((item) => item.id === platform.id);
    if (originData) {
      Object.assign(originData, platform);
    } else {
      newData.push(platform);
    }
    saveModelConfig(newData, success);
  };

  const removePlatform = (id: string) => {
    const newData = data.filter((item: IProvider) => item.id !== id);
    saveModelConfig(newData);
  };

  const [addPlatformModalCtrl, addPlatformModalContext] = AddPlatformModal.useModal({
    onSubmit(platform) {
      updatePlatform(platform, () => addPlatformModalCtrl.close());
    },
  });

  const [addModelModalCtrl, addModelModalContext] = AddModelModal.useModal({
    onSubmit(platform) {
      updatePlatform(platform, () => {
        addModelModalCtrl.close();
      });
    },
  });

  const [editModalCtrl, editModalContext] = EditModeModal.useModal({
    onChange(platform) {
      updatePlatform(platform, () => editModalCtrl.close());
    },
  });

  return (
    <div className='flex flex-col bg-2 rd-16px px-[12px] md:px-32px py-20px'>
      {addPlatformModalContext}
      {editModalContext}
      {addModelModalContext}

      {/* Header with Add Button */}
      <div className='flex-shrink-0 border-b flex items-center justify-between mb-20px'>
        <div className='text-14px text-t-primary'>{t('settings.model')}</div>
        <Button variant='outline' className='rounded-full border-t-secondary gap-2' onClick={() => addPlatformModalCtrl.open()}>
          <Plus size='16' />
          {t('settings.addModel')}
        </Button>
      </div>

      {/* Content Area */}
      <AionScrollArea className='flex-1 min-h-0' disableOverflow={isPageMode}>
        {!data || data.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-40px'>
            <Info theme='outline' size='48' className='text-t-secondary mb-16px' />
            <h3 className='text-16px font-500 text-t-primary mb-8px'>{t('settings.noConfiguredModels')}</h3>
            <p className='text-14px text-t-secondary text-center max-w-400px'>
              {t('settings.needHelpConfigGuide')}
              <a href='https://github.com/iOfficeAI/AionUi/wiki/LLM-Configuration' target='_blank' rel='noopener noreferrer' className='text-primary hover:text-primary/80 underline ml-4px'>
                {t('settings.configGuide')}
              </a>
              {t('settings.configGuideSuffix')}
            </p>
          </div>
        ) : (
          <div className='space-y-12px'>
            {(data || []).map((platform: IProvider) => {
              const key = platform.id;
              const isExpanded = collapseKey[platform.id] ?? false;
              return (
                <Collapsible
                  key={key}
                  open={isExpanded}
                  onOpenChange={(open) => {
                    setCollapseKey((prev) => ({ ...prev, [platform.id]: open }));
                  }}
                  className='border rounded-lg p-4'
                >
                  <CollapsibleTrigger asChild>
                    <div className='flex items-center justify-between w-full cursor-pointer'>
                      <span className='text-14px text-t-primary'>{platform.name}</span>
                      <div className='flex items-center gap-8px' onClick={(e) => e.stopPropagation()}>
                        <span className='text-12px text-t-secondary'>
                          <span
                            className='cursor-pointer hover:text-t-primary'
                            onClick={() => {
                              setCollapseKey((prev) => ({ ...prev, [platform.id]: !isExpanded }));
                            }}
                          >
                            {t('settings.modelCount')}（{platform.model.length}）
                          </span>
                          {' | '}
                          <span className='cursor-pointer hover:text-t-primary' onClick={() => editModalCtrl.open({ data: platform })}>
                            {t('settings.apiKeyCount')}（{getApiKeyCount(platform.apiKey)}）
                          </span>
                        </span>
                        <Button size='icon' variant='ghost' className='h-8 w-8' onClick={() => addModelModalCtrl.open({ data: platform })}>
                          <Plus size='14' />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size='icon' variant='ghost' className='h-8 w-8'>
                              <Minus size='14' />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('settings.deleteAllModelConfirm')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('settings.deleteAllModelConfirmDesc')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removePlatform(platform.id)} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
                                {t('common.confirm')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button size='icon' variant='ghost' className='h-8 w-8' onClick={() => editModalCtrl.open({ data: platform })}>
                          <Write size='14' />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className='pt-4 space-y-2'>
                    {platform.model.map((model: string, index: number, arr: string[]) => {
                      const isNewApiProvider = isNewApiPlatform(platform.platform);
                      const modelProtocol = platform.modelProtocols?.[model] || 'openai';
                      return (
                        <div key={model}>
                          <div className='flex items-center justify-between py-4px'>
                            <div className='flex items-center gap-8px'>
                              <span className='text-14px text-t-primary'>{model}</span>
                              {/* New API 协议标签（点击循环切换）/ New API protocol badge (click to cycle) */}
                              {isNewApiProvider && (
                                <Badge
                                  variant={getProtocolColor(modelProtocol)}
                                  className='cursor-pointer select-none'
                                  onClick={() => {
                                    const nextProtocol = getNextProtocol(modelProtocol);
                                    const newProtocols = { ...(platform.modelProtocols || {}) };
                                    newProtocols[model] = nextProtocol;
                                    updatePlatform({ ...platform, modelProtocols: newProtocols }, () => {
                                      setCacheKey('model.config' + Date.now());
                                    });
                                  }}
                                >
                                  {getProtocolLabel(modelProtocol)}
                                </Badge>
                              )}
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size='icon' variant='ghost' className='h-8 w-8'>
                                  <DeleteFour theme='outline' size='18' strokeWidth={2} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('settings.deleteModelConfirm')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('settings.deleteModelConfirmDesc')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      const newModels = platform.model.filter((item: string) => item !== model);
                                      // 同时清理 modelProtocols 中对应的条目 / Also clean up corresponding modelProtocols entry
                                      const newProtocols = { ...(platform.modelProtocols || {}) };
                                      delete newProtocols[model];
                                      updatePlatform({ ...platform, model: newModels, modelProtocols: Object.keys(newProtocols).length > 0 ? newProtocols : undefined }, () => {
                                        setCacheKey('model.config' + Date.now());
                                      });
                                    }}
                                    className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
                                  >
                                    {t('common.confirm')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                          {index < arr.length - 1 && <hr className='border-border-2 my-8px' />}
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </AionScrollArea>
    </div>
  );
};

export default ModelModalContent;
