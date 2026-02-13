/**
 * SessionsList - Display conversation sessions grouped by time
 */
import React, { useEffect } from 'react';
import { List, Avatar, Tag, Button, Popconfirm, Empty, Spin, Message } from '@arco-design/web-react';
import { IconDelete, IconExport } from '@arco-design/web-react/icon';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMemory } from '@/renderer/context/MemoryContext';

type Conversation = {
  id: string;
  name: string;
  type: 'gemini' | 'acp' | 'codex' | 'openclaw-gateway' | 'hivemind';
  created_at: number;
  updated_at: number;
  message_count?: number;
};

const SessionsList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { sessions, isLoading, loadSessions, deleteSession, exportToObsidian } = useMemory();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleExport = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await exportToObsidian(sessionId);
      Message.success(t('memory.sessions.exportSuccess'));
    } catch (error: any) {
      Message.error(error.message || t('memory.sessions.exportFailed'));
    }
  };

  const groupSessionsByDate = (sessions: Conversation[]) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;

    return {
      today: sessions.filter((s) => now - s.updated_at < oneDayMs),
      yesterday: sessions.filter((s) => {
        const diff = now - s.updated_at;
        return diff >= oneDayMs && diff < 2 * oneDayMs;
      }),
      lastWeek: sessions.filter((s) => {
        const diff = now - s.updated_at;
        return diff >= 2 * oneDayMs && diff < 7 * oneDayMs;
      }),
      older: sessions.filter((s) => now - s.updated_at >= 7 * oneDayMs),
    };
  };

  const renderGroup = (title: string, items: Conversation[]) => {
    if (items.length === 0) return null;

    return (
      <div key={title} className='mb-24px'>
        <h3 className='text-14px font-semibold text-t-secondary mb-12px'>{title}</h3>
        <List
          dataSource={items}
          render={(item: Conversation) => (
            <List.Item
              key={item.id}
              className='hover:bg-fill-2 cursor-pointer rd-6px p-12px'
              onClick={() => navigate(`/conversation/${item.id}`)}
              actions={[
                <Button key='export' type='text' icon={<IconExport />} size='small' onClick={(e) => handleExport(item.id, e)} />,
                <Popconfirm key='delete' title={t('memory.sessions.confirmDelete')} onOk={() => deleteSession(item.id)}>
                  <Button type='text' icon={<IconDelete />} size='small' />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar size={40}>{item.type[0].toUpperCase()}</Avatar>}
                title={item.name}
                description={
                  <div className='flex items-center gap-8px'>
                    <Tag color='arcoblue' size='small'>
                      {item.type}
                    </Tag>
                    <Tag size='small'>{item.message_count || 0} messages</Tag>
                    <span className='text-12px text-t-secondary'>{new Date(item.updated_at).toLocaleString()}</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Spin />
      </div>
    );
  }

  if (sessions.length === 0) {
    return <Empty description={t('memory.sessions.empty')} />;
  }

  const grouped = groupSessionsByDate(sessions);

  return (
    <div className='overflow-y-auto h-full p-16px'>
      {renderGroup(t('memory.sessions.today'), grouped.today)}
      {renderGroup(t('memory.sessions.yesterday'), grouped.yesterday)}
      {renderGroup(t('memory.sessions.lastWeek'), grouped.lastWeek)}
      {renderGroup(t('memory.sessions.older'), grouped.older)}
    </div>
  );
};

export default SessionsList;
