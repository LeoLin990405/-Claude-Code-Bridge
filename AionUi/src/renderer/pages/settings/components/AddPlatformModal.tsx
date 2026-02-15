import type { IProvider } from '@/common/storage';
import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { isGoogleApisHost } from '@/common/utils/urlValidation';
import ModalHOC from '@/renderer/utils/ModalHOC';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import { Search, LinkCloud, Edit } from '@icon-park/react';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useModeModeList from '../../../hooks/useModeModeList';
import useProtocolDetection from '../../../hooks/useProtocolDetection';
import HiveModal from '@/renderer/components/base/HiveModal';
import ApiKeyEditorModal from './ApiKeyEditorModal';
import ProtocolDetectionStatus from './ProtocolDetectionStatus';
import { MODEL_PLATFORMS, NEW_API_PROTOCOL_OPTIONS, getPlatformByValue, isCustomOption, isGeminiPlatform, isNewApiPlatform, type PlatformConfig } from '@/renderer/config/modelPlatforms';

/**
 * 供应商 Logo 组件
 * Provider Logo Component
 */
const ProviderLogo: React.FC<{ logo: string | null; name: string; size?: number }> = ({ logo, name, size = 20 }) => {
  if (logo) {
    return <img src={logo} alt={name} className='object-contain shrink-0' style={{ width: size, height: size }} />;
  }
  return <LinkCloud theme='outline' size={size} className='text-t-secondary flex shrink-0' />;
};

/**
 * 平台下拉选项渲染（第一层）
 * Platform dropdown option renderer (first level)
 */
const renderPlatformOption = (platform: PlatformConfig, t?: (key: string) => string) => {
  const displayName = platform.i18nKey && t ? t(platform.i18nKey) : platform.name;
  return (
    <div className='flex items-center gap-8px'>
      <ProviderLogo logo={platform.logo} name={displayName} size={18} />
      <span>{displayName}</span>
    </div>
  );
};

interface FormData {
  platform: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

const AddPlatformModal = ModalHOC<{
  onSubmit: (platform: IProvider) => void;
}>(({ modalProps, onSubmit, modalCtrl }) => {
  const { t } = useTranslation();

  // Form state (replaces Arco Form)
  const [formData, setFormData] = useState<FormData>({
    platform: 'gemini',
    baseUrl: '',
    apiKey: '',
    model: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [apiKeyEditorVisible, setApiKeyEditorVisible] = useState(false);
  const [lastDetectionInput, setLastDetectionInput] = useState<{ baseUrl: string; apiKey: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { platform, baseUrl, apiKey, model } = formData;

  // 获取当前选中的平台配置
  const selectedPlatform = useMemo(() => getPlatformByValue(platform), [platform]);

  const platformType = selectedPlatform?.platform ?? 'gemini';
  const isCustom = isCustomOption(platform);
  const isGemini = isGeminiPlatform(platformType);
  const isNewApi = isNewApiPlatform(platformType);

  // new-api 每模型协议选择状态
  const [modelProtocol, setModelProtocol] = useState<string>('openai');

  // 计算实际使用的 baseUrl
  const actualBaseUrl = useMemo(() => {
    if (baseUrl) return baseUrl;
    return selectedPlatform?.baseUrl || '';
  }, [baseUrl, selectedPlatform?.baseUrl]);

  const modelListState = useModeModeList(platformType, actualBaseUrl, apiKey, true);

  // 协议检测 Hook
  const isNonOfficialBaseUrl = baseUrl && !isGoogleApisHost(baseUrl);
  const shouldEnableDetection = isCustom || isNonOfficialBaseUrl;
  const inputChangedSinceLastSwitch = !lastDetectionInput || lastDetectionInput.baseUrl !== actualBaseUrl || lastDetectionInput.apiKey !== apiKey;
  const protocolDetection = useProtocolDetection(shouldEnableDetection && inputChangedSinceLastSwitch ? actualBaseUrl : '', shouldEnableDetection && inputChangedSinceLastSwitch ? apiKey : '', {
    debounceMs: 1000,
    autoDetect: true,
    timeout: 10000,
  });

  const shouldShowDetectionResult = shouldEnableDetection && inputChangedSinceLastSwitch;

  // 处理平台切换建议
  const handleSwitchPlatform = (suggestedPlatform: string) => {
    const targetPlatform = MODEL_PLATFORMS.find((p) => p.value === suggestedPlatform || p.name === suggestedPlatform);
    if (targetPlatform) {
      setFormData((prev) => ({ ...prev, platform: targetPlatform.value, model: '' }));
      protocolDetection.reset();
      setLastDetectionInput({ baseUrl: actualBaseUrl, apiKey });
      setErrorMessage(null);
    }
  };

  // 弹窗打开时重置表单
  useEffect(() => {
    if (modalProps.visible) {
      setFormData({ platform: 'gemini', baseUrl: '', apiKey: '', model: '' });
      setErrors({});
      protocolDetection.reset();
      setLastDetectionInput(null);
      setModelProtocol('openai');
      setErrorMessage(null);
    }
  }, [modalProps.visible]);

  useEffect(() => {
    if (platformType?.includes('gemini')) {
      void modelListState.mutate();
    }
  }, [platformType]);

  // 处理自动修复的 base_url
  useEffect(() => {
    if (modelListState.data?.fix_base_url) {
      setFormData((prev) => ({ ...prev, baseUrl: modelListState.data.fix_base_url }));
    }
  }, [modelListState.data?.fix_base_url]);

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!platform) newErrors.platform = t('validation.required');
    if (!model) newErrors.model = t('validation.required');
    if (!apiKey) newErrors.apiKey = t('validation.required');
    if ((isCustom || isNewApi) && !baseUrl) newErrors.baseUrl = t('validation.required');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [platform, model, apiKey, baseUrl, isCustom, isNewApi, t]);

  const handleSubmit = () => {
    if (!validateForm()) return;

    try {
      const name = selectedPlatform?.i18nKey ? t(selectedPlatform.i18nKey) : (selectedPlatform?.name ?? platform);
      const provider: IProvider = {
        id: uuid(),
        platform: selectedPlatform?.platform ?? 'custom',
        name,
        baseUrl: formData.baseUrl || selectedPlatform?.baseUrl || '',
        apiKey: formData.apiKey,
        model: [formData.model],
      };

      // new-api 平台：保存每模型协议配置
      if (isNewApi && formData.model) {
        provider.modelProtocols = { [formData.model]: modelProtocol };
      }

      onSubmit(provider);
      modalCtrl.close();
    } catch (error) {
      setErrorMessage(t('common.failed'));
    }
  };

  const handlePlatformChange = (value: string) => {
    setFormData((prev) => ({ ...prev, platform: value, model: '' }));
  };

  const handleModelSearch = () => {
    if ((isCustom || isNewApi) && !baseUrl) {
      setErrorMessage(t('settings.pleaseEnterBaseUrl'));
      return;
    }
    if (!isGemini && !apiKey) {
      setErrorMessage(t('settings.pleaseEnterApiKey'));
      return;
    }
    void modelListState.mutate();
  };

  const showBaseUrlField = isCustom || isNewApi || platform === 'gemini';

  return (
    <HiveModal visible={modalProps.visible} onCancel={modalCtrl.close} header={{ title: t('settings.addModel'), showClose: true }} style={{ maxWidth: '92vw', borderRadius: 16 }} contentStyle={{ background: 'var(--bg-1)', borderRadius: 16, padding: '20px 24px 16px', overflow: 'auto' }} onOk={handleSubmit} confirmLoading={modalProps.confirmLoading} okText={t('common.confirm')} cancelText={t('common.cancel')}>
      {errorMessage && <div className='mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm'>{errorMessage}</div>}

      <div className='flex flex-col gap-16px py-20px'>
        <div className='space-y-4'>
          {/* 模型平台选择 */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>
              {t('settings.modelPlatform')}
              <span className='text-destructive ml-0.5'>*</span>
            </label>
            <Select value={platform} onValueChange={handlePlatformChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODEL_PLATFORMS.map((plat) => (
                  <SelectItem key={plat.value} value={plat.value}>
                    {renderPlatformOption(plat, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.platform && <p className='text-sm text-destructive'>{errors.platform}</p>}
          </div>

          {/* Base URL */}
          {showBaseUrlField && (
            <div className='space-y-2'>
              <label className='text-sm font-medium'>
                {t('settings.baseUrl')}
                {(isCustom || isNewApi) && <span className='text-destructive ml-0.5'>*</span>}
              </label>
              <Input value={baseUrl} onChange={(e) => setFormData((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder={isNewApi ? t('settings.newApiBaseUrlPlaceholder') : selectedPlatform?.baseUrl || ''} onBlur={() => void modelListState.mutate()} />
              {errors.baseUrl && <p className='text-sm text-destructive'>{errors.baseUrl}</p>}
            </div>
          )}

          {/* API Key */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>
              {t('settings.apiKey')}
              <span className='text-destructive ml-0.5'>*</span>
            </label>
            <div className='relative'>
              <Input value={apiKey} onChange={(e) => setFormData((prev) => ({ ...prev, apiKey: e.target.value }))} onBlur={() => void modelListState.mutate()} className='pr-10' />
              <button type='button' className='absolute right-3 top-1/2 -translate-y-1/2 text-t-secondary hover:text-t-primary' onClick={() => setApiKeyEditorVisible(true)}>
                <Edit theme='outline' size={16} />
              </button>
            </div>
            <div className='space-y-2px'>
              <div className='text-11px text-t-secondary mt-2 leading-4'>{t('settings.multiApiKeyTip')}</div>
              {shouldShowDetectionResult && <ProtocolDetectionStatus isDetecting={protocolDetection.isDetecting} result={protocolDetection.result} currentPlatform={platform} onSwitchPlatform={handleSwitchPlatform} />}
            </div>
            {errors.apiKey && <p className='text-sm text-destructive'>{errors.apiKey}</p>}
          </div>

          {/* 模型选择 */}
          <div className='space-y-2'>
            <label className='text-sm font-medium'>
              {t('settings.modelName')}
              <span className='text-destructive ml-0.5'>*</span>
            </label>
            <div className='relative'>
              <Select value={model} onValueChange={(v) => setFormData((prev) => ({ ...prev, model: v }))} disabled={modelListState.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={t('settings.addModelPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {modelListState.data?.models?.map((option: { value: string; label: string }) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button type='button' className='absolute right-10 top-1/2 -translate-y-1/2 text-t-secondary hover:text-t-primary z-10' onClick={handleModelSearch}>
                <Search className='flex' />
              </button>
            </div>
            {modelListState.error && <p className='text-sm text-destructive'>{modelListState.error}</p>}
            {errors.model && <p className='text-sm text-destructive'>{errors.model}</p>}
          </div>

          {/* New API 协议选择 */}
          {isNewApi && (
            <div className='space-y-2'>
              <label className='text-sm font-medium'>{t('settings.modelProtocol')}</label>
              <Select value={modelProtocol} onValueChange={setModelProtocol}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NEW_API_PROTOCOL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className='text-11px text-t-secondary'>{t('settings.modelProtocolTip')}</span>
            </div>
          )}
        </div>
      </div>

      {/* API Key 编辑器弹窗 */}
      <ApiKeyEditorModal
        visible={apiKeyEditorVisible}
        apiKeys={apiKey || ''}
        onClose={() => setApiKeyEditorVisible(false)}
        onSave={(keys) => {
          setFormData((prev) => ({ ...prev, apiKey: keys }));
          void modelListState.mutate();
        }}
        onTestKey={async (key) => {
          try {
            const res = await ipcBridge.mode.fetchModelList.invoke({
              base_url: actualBaseUrl,
              api_key: key,
              platform: selectedPlatform?.platform ?? 'custom',
            });
            return res.success === true && Array.isArray(res.data?.mode) && res.data.mode.length > 0;
          } catch {
            return false;
          }
        }}
      />
    </HiveModal>
  );
});

export default AddPlatformModal;
