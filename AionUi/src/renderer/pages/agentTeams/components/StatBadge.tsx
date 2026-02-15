import React from 'react';
import { Typography } from '@/renderer/components/atoms/Typography';
import classNames from 'classnames';

interface StatBadgeProps {
  label: string;
  value: string | number;
  color?: 'primary' | 'success' | 'warning' | 'error';
}

export const StatBadge: React.FC<StatBadgeProps> = ({ label, value, color = 'primary' }) => {
  return (
    <div className={classNames('hive-agent-stat-badge', `hive-agent-stat-badge--${color}`)}>
      <Typography variant='caption' color='secondary' bold>
        {label}
      </Typography>
      <Typography variant='h6' bold className='hive-agent-stat-badge__value'>
        {value}
      </Typography>
    </div>
  );
};
