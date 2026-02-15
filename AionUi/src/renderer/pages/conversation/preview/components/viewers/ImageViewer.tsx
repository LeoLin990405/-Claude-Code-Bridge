/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '@/common';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ImagePreviewProps {
  filePath?: string;
  content?: string;
  fileName?: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ filePath, content, fileName }) => {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState<string>(content || '');
  const [loading, setLoading] = useState<boolean>(!!filePath && !content);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (content) {
        setImageSrc(content);
        setLoading(false);
        setError(null);
        return;
      }

      if (!filePath) {
        setImageSrc('');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const base64 = await ipcBridge.fs.getImageBase64.invoke({ path: filePath });
        if (!isMounted) return;
        setImageSrc(base64);
      } catch (err) {
        if (!isMounted) return;
        console.error('[ImagePreview] Failed to load image:', err);
        setError(t('messages.imageLoadFailed', { defaultValue: 'Failed to load image' }));
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void loadImage();

    return () => {
      isMounted = false;
    };
  }, [content, filePath, t]);

  const renderStatus = () => {
    if (loading) {
      return <div className='text-14px text-t-secondary'>{t('common.loading', { defaultValue: 'Loading...' })}</div>;
    }

    if (error) {
      return (
        <div className='text-center text-14px text-t-secondary'>
          <div>{error}</div>
          {filePath && <div className='text-12px'>{filePath}</div>}
        </div>
      );
    }

    return (
      <img
        src={imageSrc}
        alt={fileName || filePath || 'Image preview'}
        className='max-w-full max-h-full object-contain cursor-zoom-in'
        onClick={() => {
          // Open image in new window or modal for full preview
          if (imageSrc) {
            const w = window.open('', '_blank');
            if (w) {
              w.document.write(`<img src="${imageSrc}" style="max-width:100%;max-height:100vh;object-fit:contain;" />`);
              w.document.title = fileName || 'Image Preview';
            }
          }
        }}
      />
    );
  };

  return <div className='flex-1 flex items-center justify-center bg-bg-1 p-24px overflow-auto'>{renderStatus()}</div>;
};

export default ImagePreview;
