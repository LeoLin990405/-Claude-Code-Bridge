/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Message, Space, Tag, Typography } from '@arco-design/web-react';
import { IconLaunch, IconRefresh } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';
import type { INotebookLMAutomationStatus } from '@/common/ipcBridge';

const { Text } = Typography;

const NotebookLMAuth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<INotebookLMAutomationStatus | null>(null);
  const [notebookId, setNotebookId] = useState('');

  const refreshStatus = async () => {
    setLoading(true);
    try {
      const next = await ipcBridge.notebooklmAutomation.status.invoke();
      setStatus(next);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const ensureAuth = async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.notebooklmAutomation.ensureAuth.invoke({
        interactive: true,
      });

      if (result.success && result.authenticated) {
        Message.success(result.message || 'NotebookLM authentication completed');
      } else {
        Message.warning(result.error || 'NotebookLM authentication not completed');
      }
      await refreshStatus();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const openNotebook = async () => {
    setLoading(true);
    try {
      const result = await ipcBridge.notebooklmAutomation.openNotebook.invoke({
        notebookId: notebookId.trim() || undefined,
        interactive: true,
      });

      if (result.success) {
        Message.success(result.message || 'NotebookLM opened');
      } else {
        Message.error(result.error || 'Failed to open NotebookLM');
      }
      await refreshStatus();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshStatus();
  }, []);

  return (
    <Card>
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        <Space align='center'>
          <Text bold>Browser Automation Status</Text>
          <Tag color={status?.installed ? 'green' : 'red'}>{status?.installed ? 'Playwright Ready' : 'Playwright Missing'}</Tag>
          <Tag color={status?.authenticated ? 'green' : 'orange'}>{status?.authenticated ? 'Authenticated' : 'Not Authenticated'}</Tag>
          <Tag color={status?.headless ? 'purple' : 'arcoblue'}>{status?.headless ? 'Headless' : 'Interactive'}</Tag>
        </Space>

        <Text type='secondary'>Current URL: {status?.currentUrl || 'N/A'}</Text>
        {status?.lastError && <Text type='error'>Last Error: {status.lastError}</Text>}

        <Space>
          <Button icon={<IconRefresh />} onClick={refreshStatus} loading={loading}>
            Refresh
          </Button>
          <Button type='primary' onClick={ensureAuth} loading={loading}>
            Authenticate NotebookLM
          </Button>
        </Space>

        <Form layout='inline'>
          <Form.Item label='Notebook ID'>
            <Input placeholder='Optional: notebook id' value={notebookId} onChange={setNotebookId} style={{ width: 320 }} allowClear />
          </Form.Item>
          <Form.Item>
            <Button icon={<IconLaunch />} onClick={openNotebook} loading={loading}>
              Open Notebook
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
};

export default NotebookLMAuth;
