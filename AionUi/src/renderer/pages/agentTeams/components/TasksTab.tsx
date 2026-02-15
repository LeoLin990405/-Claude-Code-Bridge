import React from 'react';
import { Badge } from '@/renderer/components/ui/badge';
import { motion } from 'framer-motion';
import { Typography } from '@/renderer/components/atoms/Typography';
import DependencyGraph from './DependencyGraph';
import type { IAgentTask } from '@/common/ipcBridge';

interface TasksTabProps {
  tasks: IAgentTask[];
}

export const TasksTab: React.FC<TasksTabProps> = ({ tasks }) => {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className='hive-agent-tab-section'>
      <DependencyGraph tasks={tasks} />
      <div className='hive-agent-tasks-list'>
        {tasks.map((task) => (
          <motion.div key={task.id} layout className='hive-agent-task-row'>
            <div>
              <Typography variant='body1' bold>
                {task.subject}
              </Typography>
              <Typography variant='caption' color='secondary'>
                {task.description}
              </Typography>
            </div>
            <div className='hive-agent-task-row__meta'>
              <Typography variant='caption' color='secondary'>
                P{task.priority}
              </Typography>
              <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
