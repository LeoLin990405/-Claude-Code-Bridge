/**
 * ContextView - Display and manage active conversation context
 */
import React, { useState } from 'react';
import { Card, Empty, Button, Statistic, List, Tag } from '@arco-design/web-react';
import { IconDelete } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';

type ContextInfo = {
  conversation_id: string;
  message_count: number;
  token_count: number;
  last_updated: number;
  messages: Array<{
    id: string;
    content: string;
    type: string;
    created_at: number;
  }>;
};

const ContextView: React.FC = () => {
  const { t } = useTranslation();
  const [contextInfo] = useState<ContextInfo | null>(null);

  const handleClearContext = async () => {
    try {
      // TODO: Call IPC bridge to clear context
      // await window.electronAPI.conversation.clearContext(currentSession.id);
      console.log('Clear context');
    } catch (error) {
      console.error('Failed to clear context:', error);
    }
  };

  if (!contextInfo) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Empty description={t('memory.context.noActive')} />
      </div>
    );
  }

  return (
    <div className='p-16px h-full overflow-y-auto'>
      {/* Stats Cards */}
      <div
        className='grid gap-16px mb-24px'
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
      >
        <Card>
          <Statistic title={t('memory.context.messages')} value={contextInfo.message_count || 0} />
        </Card>
        <Card>
          <Statistic title={t('memory.context.tokens')} value={contextInfo.token_count || 0} />
        </Card>
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Button type='primary' status='danger' icon={<IconDelete />} onClick={handleClearContext}>
            {t('memory.context.clear')}
          </Button>
        </Card>
      </div>

      {/* Context Messages */}
      {contextInfo.messages && contextInfo.messages.length > 0 && (
        <Card title={t('memory.context.active')}>
          <List
            dataSource={contextInfo.messages}
            render={(item) => (
              <List.Item key={item.id}>
                <div className='w-full'>
                  <div className='flex items-center gap-8px mb-8px'>
                    <Tag size='small'>{item.type}</Tag>
                    <span className='text-12px text-t-secondary'>
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className='text-14px text-t-primary line-clamp-2'>{item.content}</div>
                </div>
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default ContextView;
