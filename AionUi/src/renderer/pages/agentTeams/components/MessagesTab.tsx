import React from 'react';
import { Timeline, TimelineItem } from '@/renderer/components/ui/timeline';
import { Typography } from '@/renderer/components/atoms/Typography';
import type { IAgentTeamMessage } from '@/common/ipcBridge';

interface MessagesTabProps {
  messages: IAgentTeamMessage[];
}

export const MessagesTab: React.FC<MessagesTabProps> = ({ messages }) => {
  return (
    <div className='hive-agent-tab-section'>
      <Timeline>
        {messages.map((message) => (
          <TimelineItem
            key={message.id}
            label={
              <Typography variant='caption' color='secondary'>
                {new Date(message.created_at).toLocaleString()}
              </Typography>
            }
          >
            <div className='hive-agent-message-card'>
              <Typography variant='body2' bold className='hive-agent-message-card__title'>
                {message.type.toUpperCase()}
              </Typography>
              <Typography variant='body2'>{message.content}</Typography>
            </div>
          </TimelineItem>
        ))}
      </Timeline>
      {messages.length === 0 && (
        <div className='hive-agent-empty-state'>
          <Typography variant='body2' color='tertiary'>
            No messages yet
          </Typography>
        </div>
      )}
    </div>
  );
};
