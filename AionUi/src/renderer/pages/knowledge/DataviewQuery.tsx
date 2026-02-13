/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Button, Card, Input, Message, Space, Table, Typography } from '@arco-design/web-react';
import { IconRefresh } from '@arco-design/web-react/icon';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const GATEWAY_URL = 'http://localhost:8765';

type DataviewResponse = {
  status: string;
  query: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  count: number;
  executed_at: string;
  error?: string;
};

const DEFAULT_QUERY = `TABLE
  source_count as "来源数量",
  created as "创建时间",
  category as "类别"
FROM "03_NotebookLM/Active_Notebooks"
WHERE type = "notebooklm-meta"
SORT created DESC
LIMIT 20`;

const DataviewQuery: React.FC = () => {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DataviewResponse | null>(null);

  const tableColumns = useMemo(() => {
    const columns = result?.columns || [];
    return columns.map((column) => ({
      title: column,
      dataIndex: column,
      render: (value: unknown) => {
        if (value === null || value === undefined) {
          return '-';
        }
        if (typeof value === 'object') {
          return JSON.stringify(value);
        }
        return String(value);
      },
    }));
  }, [result]);

  const tableData = useMemo(() => {
    return (result?.rows || []).map((row, index) => ({
      ...row,
      __rowKey: `row-${index}`,
    }));
  }, [result]);



  const runQuery = async () => {
    if (!query.trim()) {
      Message.warning('请输入 Dataview 查询语句');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/dataview/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      const payload = (await response.json()) as DataviewResponse;
      setResult(payload);

      if (payload.status === 'success') {
        Message.success(`Dataview 查询完成，共 ${payload.count} 条`);
      } else {
        Message.error(payload.error || 'Dataview 查询失败');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Message.error(message);
      setResult({
        status: 'error',
        query,
        columns: [],
        rows: [],
        count: 0,
        executed_at: new Date().toISOString(),
        error: message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }}>
      <Card>
        <Space direction='vertical' size='medium' style={{ width: '100%' }}>
          <TextArea
            value={query}
            onChange={setQuery}
            autoSize={{ minRows: 8, maxRows: 16 }}
            placeholder='输入 Dataview 查询'
          />
          <Space>
            <Button type='primary' loading={loading} onClick={runQuery}>
              执行 Dataview 查询
            </Button>
            <Button
              icon={<IconRefresh />}
              onClick={() => {
                setQuery(DEFAULT_QUERY);
              }}
            >
              恢复示例查询
            </Button>
          </Space>
          <Paragraph type='secondary' style={{ margin: 0 }}>
            提示：当前后端支持 `WHERE type/category/source_count`、`SORT`、`LIMIT` 的轻量语法子集。
          </Paragraph>
        </Space>
      </Card>

      <Card title='Dataview 查询结果'>
        {!result ? (
          <Text type='secondary'>尚未执行查询</Text>
        ) : result.status !== 'success' ? (
          <Text type='error'>{result.error || '查询失败'}</Text>
        ) : (
          <Space direction='vertical' size='small' style={{ width: '100%' }}>
            <Text type='secondary'>
              执行时间：{new Date(result.executed_at).toLocaleString()} ｜ 结果数：{result.count}
            </Text>
            <Table
              rowKey='__rowKey'
              columns={tableColumns}
              data={tableData}
              pagination={{ pageSize: 10 }}
            />
          </Space>
        )}
      </Card>
    </Space>
  );
};

export default DataviewQuery;
