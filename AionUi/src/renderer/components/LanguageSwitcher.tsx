import { ConfigStorage } from '@/common/storage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = useCallback(
    (value: string) => {
      ConfigStorage.set('language', value).catch((error: Error) => {
        console.error('Failed to save language preference:', error);
      });

      const applyLanguage = () => {
        i18n.changeLanguage(value).catch((error: Error) => {
          console.error('Failed to change language:', error);
        });
      };

      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        // 延迟到下一帧执行，确保 DOM 动画已完成 / defer to next frame so DOM animations finish
        window.requestAnimationFrame(() => window.requestAnimationFrame(applyLanguage));
      } else {
        setTimeout(applyLanguage, 0);
      }
    },
    [i18n]
  );

  return (
    <div className='flex items-center gap-8px'>
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger className='w-160px'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='zh-CN'>简体中文</SelectItem>
          <SelectItem value='zh-TW'>繁體中文</SelectItem>
          <SelectItem value='ja-JP'>日本語</SelectItem>
          <SelectItem value='ko-KR'>한국어</SelectItem>
          <SelectItem value='tr-TR'>Türkçe</SelectItem>
          <SelectItem value='en-US'>English</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitcher;
