/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGatewayStats } from '@/renderer/hooks/useGatewayStats';
import { Button } from '@/renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/renderer/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/renderer/components/ui/table';

const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { stats, cacheStats, loading, error, refresh } = useGatewayStats();

  if (loading && !stats) {
    return (
      <div className='flex items-center justify-center h-full'>
        <Loader2 className='h-10 w-10 animate-spin text-primary' />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <Alert variant='destructive'>
        <AlertTitle>{t('monitor.dashboard.error', { defaultValue: 'Failed to load monitoring data' })}</AlertTitle>
        <AlertDescription className='flex items-center justify-between'>
          <span>{error}</span>
          <Button size='sm' onClick={() => void refresh()}>
            {t('monitor.dashboard.retry', { defaultValue: 'Retry' })}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const providers = stats?.providers || [];

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>{t('monitor.dashboard.title', { defaultValue: 'Overview' })}</h1>
        <Button onClick={() => void refresh()} disabled={loading} className='flex items-center gap-2'>
          {loading ? <Loader2 className='h-4 w-4 animate-spin' /> : <RefreshCw className='h-4 w-4' />}
          {t('monitor.dashboard.refresh', { defaultValue: 'Refresh' })}
        </Button>
      </div>

      <div className='grid grid-cols-4 gap-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>{t('monitor.dashboard.totalRequests', { defaultValue: 'Total Requests' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{(stats?.total_requests || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>{t('monitor.dashboard.overallSuccessRate', { defaultValue: 'Success Rate' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(stats?.overall_success_rate || 0) > 0.9 ? 'text-green-600' : 'text-red-600'}`}>{((stats?.overall_success_rate || 0) * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>{t('monitor.dashboard.cacheEntries', { defaultValue: 'Cache Entries' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{(cacheStats?.total_entries || 0).toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium text-muted-foreground'>{t('monitor.dashboard.cacheHitRate', { defaultValue: 'Cache Hit Rate' })}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(cacheStats?.hit_rate || 0) > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>{((cacheStats?.hit_rate || 0) * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('monitor.dashboard.providerPerformance', { defaultValue: 'Provider Performance' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('monitor.dashboard.provider', { defaultValue: 'Provider' })}</TableHead>
                <TableHead>{t('monitor.dashboard.requests', { defaultValue: 'Requests' })}</TableHead>
                <TableHead>{t('monitor.dashboard.successRate', { defaultValue: 'Success Rate' })}</TableHead>
                <TableHead>{t('monitor.dashboard.avgLatency', { defaultValue: 'Avg Latency' })}</TableHead>
                <TableHead>{t('monitor.dashboard.errors', { defaultValue: 'Errors' })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center py-8'>
                    <Loader2 className='h-6 w-6 animate-spin mx-auto text-primary' />
                  </TableCell>
                </TableRow>
              ) : providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className='text-center text-muted-foreground py-8'>
                    {t('monitor.dashboard.noData', { defaultValue: 'No data available' })}
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((provider) => (
                  <TableRow key={provider.provider}>
                    <TableCell className='font-medium'>{provider.provider}</TableCell>
                    <TableCell>{provider.requests.toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={provider.success_rate > 0.9 ? 'text-green-600' : 'text-red-600'}>{(provider.success_rate * 100).toFixed(1)}%</span>
                    </TableCell>
                    <TableCell>{provider.avg_latency_ms.toFixed(0)}ms</TableCell>
                    <TableCell>
                      <span className={provider.errors > 0 ? 'text-red-600' : ''}>{provider.errors.toLocaleString()}</span>
                    </TableCell>
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

export default Dashboard;
