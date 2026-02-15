/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Button, Card, Space, Switch, Tag, Typography } from '@arco-design/web-react';
import type { IAITool } from '@/common/ipcBridge';

const { Text } = Typography;

interface ToolsPanelProps {
  tools: IAITool[];
  onDetect: () => void;
  onToggleEnabled: (tool: IAITool, enabled: boolean) => void;
  detecting?: boolean;
}

const ToolsPanel: React.FC<ToolsPanelProps> = ({ tools, onDetect, onToggleEnabled, detecting = false }) => {
  return (
    <Card
      title='Tools'
      extra={
        <Button size='small' onClick={onDetect} loading={detecting}>
          Detect
        </Button>
      }
    >
      <Space direction='vertical' style={{ width: '100%' }}>
        {tools.map((tool) => (
          <Card key={tool.id} size='small'>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Space align='center'>
                <Text>{tool.display_name}</Text>
                <Tag color={tool.detected ? 'green' : 'red'}>{tool.detected ? 'Detected' : 'Missing'}</Tag>
                <Tag color={tool.enabled ? 'arcoblue' : 'gray'}>{tool.enabled ? 'Enabled' : 'Disabled'}</Tag>
              </Space>
              <Text type='secondary'>{tool.skills_path}</Text>
              <Switch checked={Boolean(tool.enabled)} onChange={(checked) => onToggleEnabled(tool, checked)} size='small' />
            </Space>
          </Card>
        ))}
      </Space>
    </Card>
  );
};

export default ToolsPanel;
