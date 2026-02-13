/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card, Empty, List, Tag, Typography } from '@arco-design/web-react';

const { Text } = Typography;

export type TimelineEvent = {
  id: string;
  timestamp?: string;
  type: string;
  title: string;
  category?: string;
  source_count?: number;
};

type TimelineViewProps = {
  events: TimelineEvent[];
};

const TimelineView: React.FC<TimelineViewProps> = ({ events }) => {
  if (events.length === 0) {
    return (
      <Card>
        <Empty description='暂无时间线数据' />
      </Card>
    );
  }

  return (
    <Card>
      <List
        dataSource={events}
        render={(event: TimelineEvent) => (
          <List.Item key={`${event.id}-${event.timestamp || ''}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
                <Tag color='arcoblue'>{event.type}</Tag>
                {event.category && <Tag>{event.category}</Tag>}
                <Text bold>{event.title}</Text>
              </div>

              <div style={{ alignItems: 'center', display: 'flex', gap: 12 }}>
                <Text type='secondary'>{event.timestamp || 'unknown'}</Text>
                {typeof event.source_count === 'number' && (
                  <Text type='secondary'>
                    Sources: <Text code>{event.source_count}</Text>
                  </Text>
                )}
              </div>
            </div>
          </List.Item>
        )}
      />
    </Card>
  );
};

export default TimelineView;
