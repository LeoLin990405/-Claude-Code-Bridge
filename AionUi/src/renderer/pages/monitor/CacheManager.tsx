/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Message } from '@arco-design/web-react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGatewayStats } from '@/renderer/hooks/useGatewayStats';
import { gatewayMonitorService } from '@/renderer/services/GatewayMonitorService';
import { Button } from '@/renderer/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/renderer/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/renderer/components/ui/dialog';

// Simple Statistic component to replace Arco Statistic
interface StatisticProps {
  title: string;
  value: number;
  precision?: number;
  suffix?: string;
  valueClassName?: string;
}

const Statistic: React.FC<StatisticProps> = ({ title, value, precision = 0, suffix = '', valueClassName = '' }) => {
  const formattedValue = precision > 0 ? value.toFixed(precision) : value.toLocaleString();

  return (
    <div className='flex flex-col gap-1'>
      <span className='text-sm text-muted-foreground'>{title}</span>
      <span className={`text-2xl font-semibold ${valueClassName}`}>
        {formattedValue}
        {suffix}
      </span>
    </div>
  );
};

const CacheManager: React.FC = () => {
  const { t } = useTranslation();
  const { cacheStats, loading, refresh } = useGatewayStats();
  const [clearing, setClearing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const isEnabled = useMemo(() => {
    if (cacheStats?.enabled === false) {
      return false;
    }
    return true;
  }, [cacheStats]);

  const handleClearCache = () => {
    setShowConfirmDialog(true);
  };

  const handleConfirmClear = async () => {
    setShowConfirmDialog(false);
    setClearing(true);
    try {
      await gatewayMonitorService.clearCache();
      Message.success(t('monitor.cache.clearSuccess', { defaultValue: 'Cache cleared successfully' }));
      await refresh();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : t('monitor.cache.clearError', { defaultValue: 'Failed to clear cache' }));
    } finally {
      setClearing(false);
    }
  };

  const hitRateColor = (cacheStats?.hit_rate || 0) > 0.7 ? 'text-green-600' : 'text-yellow-600';

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>{t('monitor.cache.title', { defaultValue: 'Cache Management' })}</h1>
        <div className='flex items-center gap-2'>
          <Button variant='outline' onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('monitor.cache.refresh', { defaultValue: 'Refresh' })}
          </Button>
          <Button variant='destructive' onClick={handleClearCache} disabled={clearing || !isEnabled}>
            <Trash2 className='mr-2 h-4 w-4' />
            {t('monitor.cache.clear', { defaultValue: 'Clear Cache' })}
          </Button>
        </div>
      </div>

      <div className='grid grid-cols-4 gap-4'>
        <Card>
          <CardContent className='pt-6'>
            <Statistic title={t('monitor.cache.totalEntries', { defaultValue: 'Total Entries' })} value={cacheStats?.total_entries || 0} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <Statistic title={t('monitor.cache.hitRate', { defaultValue: 'Hit Rate' })} value={(cacheStats?.hit_rate || 0) * 100} precision={1} suffix='%' valueClassName={hitRateColor} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <Statistic title={t('monitor.cache.totalHits', { defaultValue: 'Total Hits' })} value={cacheStats?.total_hits || 0} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className='pt-6'>
            <Statistic title={t('monitor.cache.totalMisses', { defaultValue: 'Total Misses' })} value={cacheStats?.total_misses || 0} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>{t('monitor.cache.description', { defaultValue: 'Cache Information' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-sm text-muted-foreground'>
            {isEnabled
              ? t('monitor.cache.descriptionContent', {
                  defaultValue: 'The cache stores responses from AI providers to reduce latency and API costs. A higher hit rate indicates better cache efficiency.',
                })
              : t('monitor.cache.disabled', { defaultValue: 'Cache is currently disabled in Gateway config.' })}
          </p>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('monitor.cache.clearConfirmTitle', { defaultValue: 'Clear Cache?' })}</DialogTitle>
            <DialogDescription>
              {t('monitor.cache.clearConfirmContent', {
                defaultValue: 'This will clear all cached responses. Are you sure?',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className='gap-2 sm:gap-0'>
            <Button variant='outline' onClick={() => setShowConfirmDialog(false)}>
              {t('common.cancel', { defaultValue: 'Cancel' })}
            </Button>
            <Button variant='destructive' onClick={handleConfirmClear}>
              {t('common.confirm', { defaultValue: 'Confirm' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CacheManager;
