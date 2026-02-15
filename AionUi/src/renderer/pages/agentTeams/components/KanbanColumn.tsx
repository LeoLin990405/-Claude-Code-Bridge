/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Typography } from '@/renderer/components/atoms/Typography';
import { TaskCard } from './TaskCard';
import type { IAgentTask } from '@/common/ipcBridge';
import classNames from 'classnames';

interface KanbanColumnProps {
  id: string;
  title: string;
  tasks: IAgentTask[];
  onViewDetail?: (taskId: string) => void;
  onRun?: (taskId: string) => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待处理', color: '#94a3b8', bgColor: '#94a3b820' },
  in_progress: { label: '进行中', color: '#0ea5e9', bgColor: '#0ea5e920' },
  completed: { label: '已完成', color: '#10b981', bgColor: '#10b98120' },
  failed: { label: '失败', color: '#ef4444', bgColor: '#ef444420' },
  cancelled: { label: '已取消', color: '#6b7280', bgColor: '#6b728020' },
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, tasks, onViewDetail, onRun }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const config = STATUS_CONFIG[id] || { label: title, color: '#94a3b8', bgColor: '#94a3b820' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={classNames('hive-agent-kanban-column', {
        'hive-agent-kanban-column--over': isOver,
      })}
      style={{
        borderColor: isOver ? config.color : undefined,
        boxShadow: isOver ? `0 0 0 2px ${config.color}40` : undefined,
      }}
    >
      <div
        className='hive-agent-kanban-column__header'
        style={{
          borderTopColor: config.color,
        }}
      >
        <div className='hive-agent-kanban-column__header-inner'>
          <div className='hive-agent-kanban-column__title'>
            <Typography variant='body1' bold className='text-t-primary'>
              {config.label}
            </Typography>
            <span
              className='hive-agent-kanban-column__count'
              style={{
                backgroundColor: config.bgColor,
                color: config.color,
              }}
            >
              {tasks.length}
            </span>
          </div>
          <div className='hive-agent-kanban-column__dot' style={{ backgroundColor: config.color }} />
        </div>
      </div>

      <div
        ref={setNodeRef}
        className='hive-agent-kanban-column__content'
        style={{
          backgroundColor: isOver ? `${config.color}08` : undefined,
        }}
      >
        <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task, index) => (
            <motion.div key={task.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: index * 0.05 }}>
              <TaskCard task={task} onViewDetail={onViewDetail} onRun={onRun} />
            </motion.div>
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='hive-agent-kanban-column__empty'>
            <Typography variant='caption' color='tertiary'>
              拖拽任务到此处
            </Typography>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
