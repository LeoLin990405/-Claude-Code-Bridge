import React from 'react';
import { Badge } from '@/renderer/components/ui/badge';
import { motion } from 'framer-motion';
import { Typography } from '@/renderer/components/atoms/Typography';
import type { IAgentTeammate } from '@/common/ipcBridge';

interface TeammateCardProps {
  teammate: IAgentTeammate;
}

export const TeammateCard: React.FC<TeammateCardProps> = ({ teammate }) => {
  return (
    <motion.div whileHover={{ y: -4 }} className='hive-agent-teammate-card'>
      <div className='hive-agent-teammate-card__header'>
        <Typography variant='body1' bold>
          {teammate.name}
        </Typography>
        <Badge variant={teammate.status === 'idle' ? 'default' : 'secondary'}>{teammate.status.toUpperCase()}</Badge>
      </div>

      <Typography variant='body2' color='secondary'>
        {teammate.role}
      </Typography>

      <div className='hive-agent-teammate-card__meta'>
        <Badge variant='outline'>{teammate.provider}</Badge>
        <Badge variant='outline'>{teammate.model}</Badge>
      </div>

      {teammate.skills.length > 0 && (
        <div className='hive-agent-teammate-card__skills'>
          {teammate.skills.map((skill) => (
            <Badge key={skill} variant='secondary'>
              {skill}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
};
