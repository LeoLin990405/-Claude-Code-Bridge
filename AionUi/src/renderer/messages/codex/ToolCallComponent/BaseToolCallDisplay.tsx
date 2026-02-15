/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Card, CardContent } from '@/renderer/components/ui/card';
import { Badge } from '@/renderer/components/ui/badge';
import type { ReactNode } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export const StatusTag: React.FC<{ status: string }> = ({ status }) => {
  const { t } = useTranslation();

  const getTagProps = () => {
    switch (status) {
      case 'pending':
        return { variant: 'default' as const, text: t('tools.status.pending') };
      case 'executing':
        return { variant: 'secondary' as const, text: t('tools.status.executing') };
      case 'success':
        return { variant: 'default' as const, text: t('tools.status.success') };
      case 'error':
        return { variant: 'destructive' as const, text: t('tools.status.error') };
      case 'canceled':
        return { variant: 'outline' as const, text: t('tools.status.canceled') };
      default:
        return { variant: 'outline' as const, text: status };
    }
  };

  const { variant, text } = getTagProps();
  return <Badge variant={variant}>{text}</Badge>;
};

interface BaseToolCallDisplayProps {
  toolCallId: string;
  title: string;
  status: string;
  description?: string | ReactNode;
  icon: string;
  additionalTags?: ReactNode;
  children?: ReactNode;
}

const BaseToolCallDisplay: React.FC<BaseToolCallDisplayProps> = ({ toolCallId, title, status, description, icon, additionalTags, children }) => {
  return (
    <Card className='w-full mb-2 hive-tool-call-card'>
      <CardContent className='p-4 hive-tool-call-card__content'>
        <div className='flex items-start gap-3'>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2 mb-2'>
              <span className='text-lg'>{icon}</span>
              <span className='font-medium text-t-primary'>{title}</span>
              <StatusTag status={status} />
              {additionalTags}
            </div>

            {description && <div className='text-sm text-t-secondary mb-2 overflow-hidden'>{description}</div>}

            {children}

            <div className='text-xs text-t-secondary mt-2 hive-tool-call-card__id'>Tool Call ID: {toolCallId}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BaseToolCallDisplay;
