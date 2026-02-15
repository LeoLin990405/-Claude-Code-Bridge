import type { IProvider } from '@/common/storage';
import ModalHOC from '@/renderer/utils/ModalHOC';
import HiveModal from '@/renderer/components/base/HiveModal';
import { Badge } from '@/renderer/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useModeModeList from '../../../hooks/useModeModeList';
import { isNewApiPlatform, NEW_API_PROTOCOL_OPTIONS } from '@/renderer/config/modelPlatforms';

const AddModelModal = ModalHOC<{ data?: IProvider; onSubmit: (model: IProvider) => void }>(({ modalProps, data, onSubmit, modalCtrl }) => {
  const { t } = useTranslation();
  const [model, setModel] = useState('');
  const [modelProtocol, setModelProtocol] = useState<string>('openai');
  const isNewApi = isNewApiPlatform(data?.platform ?? '');
  const { data: modelList, isLoading } = useModeModeList(data?.platform, data?.baseUrl, data?.apiKey);
  const existingModels = data?.model || [];
  const optionsList = useMemo(() => {
    // 处理新的数据格式，可能包含 fix_base_url
    const models = Array.isArray(modelList) ? modelList : modelList?.models || [];
    if (!models || !data?.model) return models;
    return models.map((item) => {
      return { ...item, disabled: data.model.includes(item.value) };
    });
  }, [modelList, data?.model]);
  const previewModels = useMemo(() => existingModels.slice(0, 6), [existingModels]);
  const remainingCount = existingModels.length > previewModels.length ? existingModels.length - previewModels.length : 0;

  const handleConfirm = useCallback(() => {
    if (!model) return;
    const updatedData: IProvider = { ...data, model: [...existingModels, model] };

    // new-api 平台：添加模型协议配置 / new-api platform: add model protocol config
    if (isNewApi) {
      updatedData.modelProtocols = { ...(data?.modelProtocols || {}), [model]: modelProtocol };
    }

    onSubmit(updatedData);
    modalCtrl.close();
  }, [data, existingModels, model, modelProtocol, isNewApi, onSubmit, modalCtrl]);

  return (
    <HiveModal visible={modalProps.visible} onCancel={modalCtrl.close} header={{ title: t('settings.addModel'), showClose: true }} style={{ maxHeight: '90vh' }} contentStyle={{ background: 'var(--bg-1)', borderRadius: 16, padding: '20px 24px', overflow: 'auto' }} onOk={handleConfirm} okText={t('common.confirm')} cancelText={t('common.cancel')} okButtonProps={{ disabled: !model }}>
      <div className='flex flex-col gap-16px pt-20px'>
        <div className='space-y-8px'>
          <div className='text-13px font-500 text-t-secondary'>{t('settings.addModelPlaceholder')}</div>
          <Select value={model} onValueChange={setModel} disabled={isLoading}>
            <SelectTrigger>
              <SelectValue placeholder={t('settings.addModelPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {optionsList?.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* New API 协议选择 / New API Protocol Selection */}
        {isNewApi && (
          <div className='space-y-8px'>
            <div className='text-13px font-500 text-t-secondary'>{t('settings.modelProtocol')}</div>
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
            <div className='text-11px text-t-secondary leading-4'>{t('settings.modelProtocolTip')}</div>
          </div>
        )}

        <div className='space-y-8px'>
          {/* <div className='text-13px font-500 text-t-secondary'>{t('settings.currentModelsLabel')}</div>
          {existingModels.length === 0 ? (
            <div className='text-13px text-t-secondary bg-fill-1 rd-8px px-12px py-14px border border-dashed border-border-2'>{t('settings.addModelNoExisting')}</div>
          ) : (
            <div className='flex flex-wrap gap-8px bg-1 rd-8px px-12px py-10px border border-solid border-border-2'>
              {previewModels.map((item) => (
                <Badge key={item} variant="secondary" className="text-12px">
                  {item}
                </Badge>
              ))}
              {remainingCount > 0 && <Badge variant="outline">{t('settings.addModelMoreCount', { count: remainingCount })}</Badge>}
            </div>
          )} */}
        </div>

        {/* <div className='text-12px tet-t-tertiary leading-5 bg-fill-1 rd-8px px-12px py-10px border border-dashed border-border-2'>{t('settings.addModelTips')}</div> */}
      </div>
      {/* <div className='text-12px text-t-secondary leading-5 my-4'>{model ? t('settings.addModelSelectedHint', { model }) : t('settings.addModelHint')}</div> */}
    </HiveModal>
  );
});

export default AddModelModal;
