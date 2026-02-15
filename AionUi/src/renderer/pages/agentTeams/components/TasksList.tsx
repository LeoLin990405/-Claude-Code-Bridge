/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TaskCard } from './TaskCard';
import { Typography } from '@/renderer/components/atoms/Typography';
import type { IAgentTask } from '@/common/ipcBridge';

interface TasksListProps {
  tasks: IAgentTask[];
  onViewDetail?: (taskId: string) => void;
  onRun?: (taskId: string) => void;
}

export const TasksList: React.FC<TasksListProps> = ({ tasks, onViewDetail, onRun }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 5,
  });

  if (tasks.length === 0) {
    return (
      <div className='hive-agent-tasks-virtual-empty'>
        <Typography variant='body2' color='secondary'>
          暂无任务
        </Typography>
      </div>
    );
  }

  return (
    <div ref={parentRef} className='hive-agent-tasks-virtual-list'>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            className='hive-agent-tasks-virtual-item'
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <TaskCard task={tasks[virtualItem.index]} onViewDetail={onViewDetail} onRun={onRun} />
          </div>
        ))}
      </div>
    </div>
  );
};
