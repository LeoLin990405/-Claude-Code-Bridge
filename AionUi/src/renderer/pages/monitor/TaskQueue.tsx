/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gatewayMonitorService, type Task } from '@/renderer/services/GatewayMonitorService';
import { Button } from '@/renderer/components/ui/button';
import { Card, CardContent } from '@/renderer/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/renderer/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/renderer/components/ui/table';
import { Badge } from '@/renderer/components/ui/badge';

const TaskQueue: React.FC = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await gatewayMonitorService.getTasks(50);
      setTasks(data);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 10000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => (statusFilter === 'all' ? true : task.status === statusFilter));
  }, [statusFilter, tasks]);

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className='space-y-4 transition-all duration-200 ease-in-out'>
      <div className='flex items-center justify-between mb-4'>
        <h1 className='text-xl font-semibold'>{t('monitor.tasks.title', { defaultValue: 'Task Queue' })}</h1>
        <div className='flex items-center gap-2'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[140px]'>
              <SelectValue placeholder={t('monitor.tasks.all', { defaultValue: 'All' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>{t('monitor.tasks.all', { defaultValue: 'All' })}</SelectItem>
              <SelectItem value='pending'>{t('monitor.tasks.pending', { defaultValue: 'Pending' })}</SelectItem>
              <SelectItem value='completed'>{t('monitor.tasks.completed', { defaultValue: 'Completed' })}</SelectItem>
              <SelectItem value='failed'>{t('monitor.tasks.failed', { defaultValue: 'Failed' })}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => void refresh()} disabled={loading} className='flex items-center gap-2'>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('monitor.tasks.refresh', { defaultValue: 'Refresh' })}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[220px]'>{t('monitor.tasks.id', { defaultValue: 'Task ID' })}</TableHead>
                <TableHead className='w-[120px]'>{t('monitor.tasks.status', { defaultValue: 'Status' })}</TableHead>
                <TableHead className='w-[140px]'>{t('monitor.tasks.provider', { defaultValue: 'Provider' })}</TableHead>
                <TableHead className='w-[200px]'>{t('monitor.tasks.createdAt', { defaultValue: 'Created At' })}</TableHead>
                <TableHead className='w-[200px]'>{t('monitor.tasks.completedAt', { defaultValue: 'Completed At' })}</TableHead>
                <TableHead>{t('monitor.tasks.error', { defaultValue: 'Error' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                    {t('common.loading', { defaultValue: 'Loading...' })}
                  </TableCell>
                </TableRow>
              ) : filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                    {t('common.noData', { defaultValue: 'No data' })}
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      <code className='text-xs'>{task.id.slice(0, 12)}...</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(task.status)}>{task.status}</Badge>
                    </TableCell>
                    <TableCell>{task.provider}</TableCell>
                    <TableCell>{task.created_at ? new Date(task.created_at).toLocaleString() : '-'}</TableCell>
                    <TableCell>{task.completed_at ? new Date(task.completed_at).toLocaleString() : '-'}</TableCell>
                    <TableCell>{task.error ? <span className='text-destructive'>{task.error}</span> : '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskQueue;
