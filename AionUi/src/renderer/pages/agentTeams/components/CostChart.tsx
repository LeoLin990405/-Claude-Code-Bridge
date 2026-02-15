/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Badge } from '@/renderer/components/ui/badge';
import { motion } from 'framer-motion';
import type { IAgentCostAnalysis } from '@/common/ipcBridge';
import { Typography } from '@/renderer/components/atoms/Typography';

interface CostChartProps {
  cost: IAgentCostAnalysis | null;
  title?: string;
}

const CostChart: React.FC<CostChartProps> = ({ cost, title }) => {
  const rows = useMemo(() => {
    if (!cost) {
      return [];
    }

    return Object.entries(cost.by_provider)
      .map(([provider, row]) => ({ provider, ...row }))
      .sort((a, b) => b.cost_usd - a.cost_usd);
  }, [cost]);

  const maxValue = useMemo(() => rows.reduce((acc, row) => Math.max(acc, row.cost_usd), 0), [rows]);

  if (!cost || rows.length === 0) {
    return (
      <div className='hive-agent-empty-state'>
        <div className='text-muted-foreground'>No cost data yet</div>
      </div>
    );
  }

  return (
    <div className='hive-agent-cost-chart'>
      {title && <Typography variant='h6'>{title}</Typography>}
      <div className='hive-agent-cost-chart__rows'>
        {rows.map((row) => {
          const width = maxValue > 0 ? Math.max(6, (row.cost_usd / maxValue) * 100) : 0;
          return (
            <div key={row.provider} className='hive-agent-cost-chart__row'>
              <div className='hive-agent-cost-chart__header'>
                <div className='hive-agent-cost-chart__title'>
                  <Badge variant='default'>{row.provider}</Badge>
                  <Typography variant='body2' bold>
                    ${row.cost_usd.toFixed(4)}
                  </Typography>
                </div>
                <Typography variant='caption' color='secondary'>
                  {row.tasks_count} tasks • {row.input_tokens + row.output_tokens} tokens
                </Typography>
              </div>
              <div className='hive-agent-cost-chart__track'>
                <motion.div initial={{ width: 0 }} animate={{ width: `${width}%` }} transition={{ duration: 1, ease: 'easeOut' }} className='hive-agent-cost-chart__bar' />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CostChart;
