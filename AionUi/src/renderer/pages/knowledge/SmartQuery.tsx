/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Button, Card, Input, Message, Space, Typography } from '@arco-design/web-react';
import { IconSend } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';
import type { INotebookLMAutomationQueryResult } from '@/common/ipcBridge';

const { Paragraph, Text } = Typography;
const { TextArea } = Input;

const SmartQuery: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [notebookId, setNotebookId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<INotebookLMAutomationQueryResult | null>(null);

  const handleQuery = async () => {
    const trimmed = question.trim();
    if (!trimmed) {
      Message.warning('Please enter a question');
      return;
    }

    setLoading(true);
    try {
      const response = await ipcBridge.notebooklmAutomation.query.invoke({
        question: trimmed,
        notebookId: notebookId.trim() || undefined,
        interactive: false,
      });

      setResult(response);

      if (response.success) {
        Message.success('Query completed');
      } else if (response.requiresInteractive) {
        Message.warning('NotebookLM authentication is required. Please authenticate first.');
      } else {
        Message.error(response.error || 'Query failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Message.error(message);
      setResult({ success: false, references: [], error: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Space direction='vertical' size='large' style={{ width: '100%' }}>
        <Input placeholder='Optional notebook id for direct routing' value={notebookId} onChange={setNotebookId} allowClear style={{ width: 360 }} />

        <TextArea placeholder='Ask NotebookLM a research question...' value={question} onChange={setQuestion} autoSize={{ minRows: 4, maxRows: 8 }} />

        <Space>
          <Button type='primary' icon={<IconSend />} onClick={handleQuery} loading={loading}>
            Send Query
          </Button>
          {result?.requiresInteractive && (
            <Button
              onClick={async () => {
                const authResult = await ipcBridge.notebooklmAutomation.ensureAuth.invoke({ interactive: true });
                if (authResult.success) {
                  Message.success('Authentication completed, please retry query');
                } else {
                  Message.warning(authResult.error || 'Authentication incomplete');
                }
              }}
            >
              Authenticate Now
            </Button>
          )}
        </Space>

        {result && (
          <Card size='small'>
            <Space direction='vertical' style={{ width: '100%' }}>
              <Text bold>{result.success ? 'Answer' : 'Result'}</Text>
              {result.url && <Text type='secondary'>URL: {result.url}</Text>}
              {result.answer ? <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{result.answer}</Paragraph> : <Text type='secondary'>{result.error || 'No answer extracted yet'}</Text>}
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );
};

export default SmartQuery;
