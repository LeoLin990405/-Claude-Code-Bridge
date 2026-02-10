/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConversationProvider } from '@/renderer/context/ConversationContext';
import { useHivemindStatus } from '@/renderer/hooks/useHivemindStatus';
import FlexFullContainer from '@renderer/components/FlexFullContainer';
import MessageList from '@renderer/messages/MessageList';
import { MessageListProvider, useMessageLstCache } from '@renderer/messages/hooks';
import HOC from '@renderer/utils/HOC';
import { Alert } from '@arco-design/web-react';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import LocalImageView from '../../../components/LocalImageView';
import ConversationChatConfirm from '../components/ConversationChatConfirm';
import HivemindSendBox from './HivemindSendBox';

const HivemindChat: React.FC<{
  conversation_id: string;
  workspace?: string;
  gatewayUrl?: string;
}> = ({ conversation_id, workspace }) => {
  useMessageLstCache(conversation_id);
  const updateLocalImage = LocalImageView.useUpdateLocalImage();
  const { t } = useTranslation();
  const { connected, reconnecting } = useHivemindStatus();

  useEffect(() => {
    if (!workspace) {
      return;
    }
    updateLocalImage({ root: workspace });
  }, [workspace, updateLocalImage]);

  return (
    <ConversationProvider value={{ conversationId: conversation_id, workspace, type: 'hivemind' }}>
      <div className='flex-1 flex flex-col px-20px'>
        {!connected && (
          <Alert
            className='mx-auto max-w-800px w-full mt-8px'
            type='warning'
            content={reconnecting ? t('hivemind.status.reconnecting') : t('hivemind.status.reconnectFailed')}
            showIcon
            closable
          />
        )}
        <FlexFullContainer>
          <MessageList className='flex-1'></MessageList>
        </FlexFullContainer>
        <ConversationChatConfirm conversation_id={conversation_id}>
          <HivemindSendBox conversation_id={conversation_id} />
        </ConversationChatConfirm>
      </div>
    </ConversationProvider>
  );
};

export default HOC(MessageListProvider)(HivemindChat);
