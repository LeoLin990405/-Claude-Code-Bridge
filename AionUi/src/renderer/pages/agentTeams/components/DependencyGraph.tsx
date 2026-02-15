/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Badge } from '@/renderer/components/ui/badge';
import { motion } from 'framer-motion';
import type { IAgentTask } from '@/common/ipcBridge';
import { Typography } from '@/renderer/components/atoms/Typography';

const statusVariant: Record<IAgentTask['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
};

interface DependencyGraphProps {
  tasks: IAgentTask[];
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ tasks }) => {
  const taskMap = useMemo(() => {
    const map = new Map<string, IAgentTask>();
    for (const task of tasks) {
      map.set(task.id, task);
    }
    return map;
  }, [tasks]);

  const nodeRows = useMemo(() => {
    return tasks.map((task) => {
      const deps = task.blocked_by.map((depId) => taskMap.get(depId)).filter(Boolean) as IAgentTask[];
      const dependents = task.blocks.map((depId) => taskMap.get(depId)).filter(Boolean) as IAgentTask[];
      const isReady = deps.every((dep) => dep.status === 'completed');

      return {
        task,
        deps,
        dependents,
        isReady,
      };
    });
  }, [taskMap, tasks]);

  if (tasks.length === 0) {
    return (
      <div className='hive-agent-empty-state'>
        <div className='text-muted-foreground'>No tasks yet</div>
      </div>
    );
  }

  return (
    <div className='hive-agent-dependency-graph'>
      <Typography variant='h6'>Dependency Graph</Typography>
      <div className='hive-agent-dependency-graph__list'>
        {nodeRows.map(({ task, deps, dependents, isReady }) => (
          <motion.div key={task.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className='hive-agent-dependency-node'>
            <div className='flex flex-col w-full gap-2'>
              <div className='hive-agent-dependency-node__header'>
                <div className='hive-agent-dependency-node__badges'>
                  <Typography variant='body2' bold>
                    {task.subject}
                  </Typography>
                  <Badge variant={statusVariant[task.status]}>{task.status}</Badge>
                  {task.status === 'pending' && <Badge variant={isReady ? 'default' : 'secondary'}>{isReady ? 'READY' : 'BLOCKED'}</Badge>}
                </div>
                <Typography variant='caption' color='tertiary'>
                  Priority P{task.priority}
                </Typography>
              </div>

              <div className='hive-agent-dependency-node__grid'>
                <div>
                  <Typography variant='caption' color='secondary' bold className='hive-agent-dependency-node__label'>
                    Depends on:
                  </Typography>
                  <div className='hive-agent-dependency-node__tags'>
                    {deps.length === 0 ? (
                      <Typography variant='caption' color='tertiary'>
                        None
                      </Typography>
                    ) : (
                      deps.map((dep) => (
                        <Badge key={dep.id} variant='outline'>
                          {dep.subject}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <Typography variant='caption' color='secondary' bold className='hive-agent-dependency-node__label'>
                    Blocks:
                  </Typography>
                  <div className='hive-agent-dependency-node__tags'>
                    {dependents.length === 0 ? (
                      <Typography variant='caption' color='tertiary'>
                        None
                      </Typography>
                    ) : (
                      dependents.map((dep) => (
                        <Badge key={dep.id} variant='outline'>
                          {dep.subject}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default DependencyGraph;
