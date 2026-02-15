/**
 * @license
 * Copyright 2025 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { IMessageAgentStatus } from '@/common/chatLib';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface MessageAgentStatusProps {
  message: IMessageAgentStatus;
}

const MessageAgentStatus: React.FC<MessageAgentStatusProps> = ({ message }) => {
  const { t } = useTranslation();
  const { backend, status } = message.content;

  const getStatusBadge = () => {
    switch (status) {
      case 'connecting':
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-blue-500 animate-pulse' />
            <span className='text-sm'>{t('acp.status.connecting', { agent: backend })}</span>
          </div>
        );
      case 'connected':
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-green-500' />
            <span className='text-sm'>{t('acp.status.connected', { agent: backend })}</span>
          </div>
        );
      case 'authenticated':
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-green-500' />
            <span className='text-sm'>{t('acp.status.authenticated', { agent: backend })}</span>
          </div>
        );
      case 'session_active':
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-green-500' />
            <span className='text-sm'>{t('acp.status.session_active', { agent: backend })}</span>
          </div>
        );
      case 'disconnected':
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-gray-400' />
            <span className='text-sm'>{t('acp.status.disconnected', { agent: backend })}</span>
          </div>
        );
      case 'error':
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-red-500' />
            <span className='text-sm'>{t('acp.status.error')}</span>
          </div>
        );
      default:
        return (
          <div className='flex items-center gap-2'>
            <div className='h-2 w-2 rounded-full bg-gray-400' />
            <span className='text-sm'>{t('acp.status.unknown')}</span>
          </div>
        );
    }
  };

  const isError = status === 'error';
  const isSuccess = status === 'connected' || status === 'authenticated' || status === 'session_active';

  return (
    <div
      className='agent-status-message hive-agent-status flex items-center gap-3 p-3 rounded-lg border'
      style={{
        backgroundColor: isError ? 'var(--color-danger-light-1)' : isSuccess ? 'var(--color-success-light-1)' : 'var(--color-primary-light-1)',
        borderColor: isError ? 'rgb(var(--danger-3))' : isSuccess ? 'rgb(var(--success-3))' : 'rgb(var(--primary-3))',
        color: isError ? 'rgb(var(--danger-6))' : isSuccess ? 'rgb(var(--success-6))' : 'rgb(var(--primary-6))',
      }}
    >
      <div className='flex items-center gap-2'>
        <span className='font-bold capitalize'>{backend.charAt(0).toUpperCase() + backend.slice(1)}</span>
      </div>

      <div className='flex-1'>{getStatusBadge()}</div>
    </div>
  );
};

export default MessageAgentStatus;
