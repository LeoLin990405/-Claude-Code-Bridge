/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Card, Empty, Grid, List, Progress, Space, Tag, Typography } from '@arco-design/web-react';

const { Row, Col } = Grid;
const { Text, Title } = Typography;

export type DashboardNotebook = {
  notebook_id: string;
  title: string;
  category: string;
  source_count: number;
  max_sources: number;
  usage_ratio: number;
  created?: string;
};

export type DashboardSnapshot = {
  status: string;
  snapshot_at: string;
  total_notebooks: number;
  total_sources: number;
  near_limit_count: number;
  categories: Record<string, number>;
  notebooks: DashboardNotebook[];
  obsidian_cli_available: boolean;
  notebooklm_manager_ready: boolean;
};

type DashboardProps = {
  data: DashboardSnapshot | null;
};

const Dashboard: React.FC<DashboardProps> = ({ data }) => {
  if (!data || data.status !== 'success') {
    return (
      <Card>
        <Empty description='暂无监控数据' />
      </Card>
    );
  }

  const nearLimit = data.notebooks.filter((item) => item.usage_ratio >= 0.8).sort((a, b) => b.usage_ratio - a.usage_ratio);

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Text type='secondary'>Total Notebooks</Text>
            <Title heading={4}>{data.total_notebooks}</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type='secondary'>Total Sources</Text>
            <Title heading={4}>{data.total_sources}</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type='secondary'>Near Limit</Text>
            <Title heading={4}>{data.near_limit_count}</Title>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type='secondary'>Snapshot</Text>
            <Title heading={6}>{data.snapshot_at}</Title>
          </Card>
        </Col>
      </Row>

      <Card title='Category Distribution'>
        <Space wrap>
          {Object.entries(data.categories).map(([category, count]) => (
            <Tag key={category} color='arcoblue'>
              {category}: {count}
            </Tag>
          ))}
        </Space>
      </Card>

      <Card title='Source Utilization'>
        <List
          dataSource={data.notebooks}
          render={(item: DashboardNotebook) => {
            const percent = Math.round((item.usage_ratio || 0) * 100);
            return (
              <List.Item key={item.notebook_id}>
                <div style={{ width: '100%' }}>
                  <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <Text bold>{item.title}</Text>
                      <Text type='secondary' style={{ marginLeft: 8 }}>
                        {item.category}
                      </Text>
                    </div>
                    <Text type='secondary'>
                      {item.source_count}/{item.max_sources}
                    </Text>
                  </div>
                  <Progress percent={percent} status={percent >= 90 ? 'error' : percent >= 80 ? 'warning' : 'normal'} />
                </div>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card title='Near Limit Watchlist'>
        {nearLimit.length === 0 ? (
          <Text type='secondary'>All notebooks are within healthy source usage.</Text>
        ) : (
          <List
            dataSource={nearLimit}
            render={(item: DashboardNotebook) => (
              <List.Item key={`${item.notebook_id}-limit`}>
                <Space>
                  <Text bold>{item.title}</Text>
                  <Tag color='orange'>{Math.round(item.usage_ratio * 100)}%</Tag>
                </Space>
              </List.Item>
            )}
          />
        )}
      </Card>
    </Space>
  );
};

export default Dashboard;
