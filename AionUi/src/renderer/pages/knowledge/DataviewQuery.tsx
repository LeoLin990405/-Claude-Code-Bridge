/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/renderer/components/ui/table';
import { RefreshCw } from 'lucide-react';

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
    return result?.columns || [];
  }, [result]);

  const tableData = useMemo(() => {
    return (result?.rows || []).map((row, index) => ({
      ...row,
      __rowKey: `row-${index}`,
    }));
  }, [result]);

  const runQuery = async () => {
    if (!query.trim()) {
      console.warn('请输入 Dataview 查询语句');
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

      if (payload.status !== 'success') {
        console.error(payload.error || 'Dataview 查询失败');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
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
    <div className="flex flex-col gap-6 w-full">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={8}
            placeholder='输入 Dataview 查询'
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <div className="flex gap-2">
            <Button onClick={runQuery} disabled={loading}>
              {loading ? '执行中...' : '执行 Dataview 查询'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setQuery(DEFAULT_QUERY);
              }}
              className="gap-2"
            >
              <RefreshCw size={16} />
              恢复示例查询
            </Button>
          </div>
          <p className="text-sm text-muted-foreground m-0">
            提示：当前后端支持 `WHERE type/category/source_count`、`SORT`、`LIMIT` 的轻量语法子集。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dataview 查询结果</CardTitle>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-muted-foreground">尚未执行查询</p>
          ) : result.status !== 'success' ? (
            <p className="text-destructive">{result.error || '查询失败'}</p>
          ) : (
            <div className="space-y-2 w-full">
              <p className="text-sm text-muted-foreground">
                执行时间：{new Date(result.executed_at).toLocaleString()} ｜ 结果数：{result.count}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.map((column) => (
                      <TableHead key={column}>{column}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.__rowKey as string}>
                      {tableColumns.map((column) => {
                        const value = row[column];
                        let displayValue: string;
                        if (value === null || value === undefined) {
                          displayValue = '-';
                        } else if (typeof value === 'object') {
                          displayValue = JSON.stringify(value);
                        } else {
                          displayValue = String(value);
                        }
                        return (
                          <TableCell key={`${row.__rowKey}-${column}`}>
                            {displayValue}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataviewQuery;
