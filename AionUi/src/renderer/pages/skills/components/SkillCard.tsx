/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Button, Card, Popconfirm, Space, Tag, Typography } from '@arco-design/web-react';
import type { ISkill } from '@/common/ipcBridge';

const { Paragraph, Text } = Typography;

interface SkillCardProps {
  skill: ISkill;
  onEdit: (skill: ISkill) => void;
  onDelete: (skill: ISkill) => void;
}

const SkillCard: React.FC<SkillCardProps> = ({ skill, onEdit, onDelete }) => {
  return (
    <Card size='small'>
      <Space direction='vertical' style={{ width: '100%' }}>
        <Space align='center' style={{ justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <Tag color='purple'>{skill.name}</Tag>
            <Tag>{skill.category}</Tag>
          </Space>
          <Space>
            <Button size='mini' type='text' onClick={() => onEdit(skill)}>
              Edit
            </Button>
            <Popconfirm title='Delete this skill?' onOk={() => onDelete(skill)}>
              <Button size='mini' status='danger' type='text'>
                Delete
              </Button>
            </Popconfirm>
          </Space>
        </Space>

        <Paragraph style={{ margin: 0 }} type='secondary'>
          {skill.description || 'No description'}
        </Paragraph>

        <Text type='secondary'>Updated: {new Date(skill.updated_at).toLocaleString()}</Text>

        {skill.tags.length > 0 ? (
          <Space wrap>
            {skill.tags.map((tag) => (
              <Tag key={tag} color='arcoblue'>
                {tag}
              </Tag>
            ))}
          </Space>
        ) : null}
      </Space>
    </Card>
  );
};

export default SkillCard;
