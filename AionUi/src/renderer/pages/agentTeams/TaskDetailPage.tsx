/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Badge } from '@/renderer/components/ui/badge';
import { Description } from '@/renderer/components/ui/description';
import { Typography } from '@/renderer/components/atoms/Typography';
import type { IAgentTask } from '@/common/ipcBridge';
import { agentTeamsApi } from './api';

const statusVariant: Record<IAgentTask['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<IAgentTask | null>(null);
  const [dependencies, setDependencies] = useState<{ blocks: string[]; blocked_by: string[] }>({ blocks: [], blocked_by: [] });

  const dependencySummary = useMemo(() => {
    return {
      blockedBy: dependencies.blocked_by.length > 0 ? dependencies.blocked_by.join(', ') : '-',
      blocks: dependencies.blocks.length > 0 ? dependencies.blocks.join(', ') : '-',
    };
  }, [dependencies]);

  const refresh = async () => {
    if (!taskId) {
      return;
    }

    setLoading(true);
    try {
      const [nextTask, nextDependencies] = await Promise.all([agentTeamsApi.getTask(taskId), agentTeamsApi.getTaskDependencies(taskId)]);
      setTask(nextTask);
      setDependencies(nextDependencies);
    } catch (error) {
      console.error(error);
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  const transition = async (status: IAgentTask['status']) => {
    if (!task) {
      return;
    }

    try {
      const next = await agentTeamsApi.updateTask(task.id, { status });
      setTask(next);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    void refresh();
  }, [taskId]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (!task) {
    return (
      <Card className='hive-agent-surface hive-agent-page hive-agent-page--task-detail'>
        <CardContent>Task not found.</CardContent>
      </Card>
    );
  }

  return (
    <Card className='hive-agent-surface hive-agent-page hive-agent-page--task-detail'>
      <CardHeader>
        <CardTitle>{task.subject}</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <Description
          column={2}
          items={[
            { label: 'Task ID', value: task.id },
            { label: 'Team ID', value: task.team_id },
            {
              label: 'Status',
              value: <Badge variant={statusVariant[task.status]}>{task.status}</Badge>,
            },
            { label: 'Priority', value: task.priority },
            { label: 'Assigned To', value: task.assigned_to || '-' },
            { label: 'Provider / Model', value: `${task.provider || '-'} / ${task.model || '-'}` },
            { label: 'Created', value: new Date(task.created_at).toLocaleString() },
            { label: 'Updated', value: new Date(task.updated_at).toLocaleString() },
            { label: 'Started', value: task.started_at ? new Date(task.started_at).toLocaleString() : '-' },
            { label: 'Completed', value: task.completed_at ? new Date(task.completed_at).toLocaleString() : '-' },
            { label: 'Depends On', value: dependencySummary.blockedBy },
            { label: 'Blocks', value: dependencySummary.blocks },
            { label: 'Cost (USD)', value: task.cost_usd.toFixed(4) },
            { label: 'Description', value: task.description },
            { label: 'Result', value: task.result || '-' },
            { label: 'Error', value: task.error || '-' },
          ]}
        />

        <div className='hive-agent-page__actions flex flex-wrap gap-2 pt-4'>
          <Button onClick={() => void refresh()} variant='outline'>
            Refresh
          </Button>
          <Button onClick={() => void transition('pending')} variant='outline'>
            Set Pending
          </Button>
          <Button onClick={() => void transition('in_progress')} variant='outline'>
            Set In Progress
          </Button>
          <Button
            onClick={async () => {
              const result = await agentTeamsApi.runTask(task.id);
              await refresh();
            }}
          >
            Run Task
          </Button>
          <Button variant='destructive' onClick={() => void transition('failed')}>
            Fail
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskDetailPage;
