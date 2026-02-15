/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Badge } from '@/renderer/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/renderer/components/ui/table';
import { motion } from 'framer-motion';
import { ipcBridge } from '@/common';
import type { IAgentTask, IAgentTeamMessage } from '@/common/ipcBridge';
import { Typography } from '@/renderer/components/atoms/Typography';

const MonitorDashboard: React.FC = () => {
  const [recentTasks, setRecentTasks] = useState<IAgentTask[]>([]);
  const [recentMessages, setRecentMessages] = useState<IAgentTeamMessage[]>([]);

  useEffect(() => {
    const unsubscribeTask = ipcBridge.agentTeams.onTaskUpdate.on(({ task }) => {
      setRecentTasks((prev) => [task, ...prev.filter((item) => item.id !== task.id)].slice(0, 30));
    });

    const unsubscribeMessage = ipcBridge.agentTeams.onMessageReceived.on(({ message }) => {
      setRecentMessages((prev) => [message, ...prev].slice(0, 50));
    });

    return () => {
      unsubscribeTask();
      unsubscribeMessage();
    };
  }, []);

  const getStatusVariant = (status: IAgentTask['status']) => {
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className='hive-agent-page hive-agent-page--monitor'>
      <div className='hive-agent-page__header hive-agent-page__header--stack'>
        <Typography variant='h4' bold>
          Real-time Monitor
        </Typography>
        <Typography variant='body2' color='secondary'>
          Live stream of tasks and messages across all teams
        </Typography>
      </div>

      <div className='flex flex-col gap-6 w-full'>
        <Card className='hive-agent-surface'>
          <CardHeader>
            <CardTitle>
              <Typography variant='h6'>Task Updates</Typography>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <Typography variant='body2' bold>
                        {task.subject}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <code className='hive-agent-code'>{task.team_id}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
                    </TableCell>
                    <TableCell>{task.provider}</TableCell>
                    <TableCell>
                      <Typography variant='caption' color='secondary'>
                        {new Date(task.updated_at).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className='hive-agent-surface'>
          <CardHeader>
            <CardTitle>
              <Typography variant='h6'>Message Stream</Typography>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Content</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMessages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>
                      <Badge variant='outline'>{message.type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>
                      <code className='hive-agent-code'>{message.team_id}</code>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' className='line-clamp-1'>
                        {message.content}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='caption' color='secondary'>
                        {new Date(message.created_at).toLocaleTimeString()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default MonitorDashboard;
