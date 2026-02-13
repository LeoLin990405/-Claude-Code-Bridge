/**
 * Knowledge Hub v3.0 - Main Page
 *
 * Unified interface for NotebookLM + Obsidian + PDF Pipeline + Browser Automation + Visualization.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Empty, Input, List, Message, Space, Spin, Tabs, Tag, Typography, Upload } from '@arco-design/web-react';
import { IconBook, IconFile, IconLaunch, IconRefresh, IconSearch, IconSound, IconUpload } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';
import type { IObsidianDailySyncStatus } from '@/common/ipcBridge';
import KnowledgeGraph, { type KnowledgeGraphEdge, type KnowledgeGraphNode } from '@/renderer/components/KnowledgeGraph';
import TimelineView, { type TimelineEvent } from '@/renderer/components/TimelineView';
import Dashboard, { type DashboardSnapshot } from './Dashboard';
import NotebookLMAuth from './NotebookLMAuth';
import SmartQuery from './SmartQuery';
import DataviewQuery from './DataviewQuery';

const { TabPane } = Tabs;
const { Paragraph, Text, Title } = Typography;

const GATEWAY_URL = 'http://localhost:8765';
const VAULT_NAME = 'Knowledge-Hub';

type Notebook = {
  notebook_id: string;
  title: string;
  category: string;
  source_count: number;
  created_at: string;
};

type SystemStatus = {
  obsidian_cli_available: boolean;
  obsidian_cli_version: string | null;
  vault_path: string;
  notebooklm_manager_ready: boolean;
  total_notebooks: number;
};

type ObsidianSearchResult = {
  path: string;
  snippet?: string;
};

const formatTimestamp = (value?: number): string => {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'N/A' : date.toLocaleString();
};

const KnowledgeHubPage: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchingVault, setSearchingVault] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [obsidianResults, setObsidianResults] = useState<ObsidianSearchResult[]>([]);

  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [graphNodes, setGraphNodes] = useState<KnowledgeGraphNode[]>([]);
  const [graphEdges, setGraphEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [dailySyncStatus, setDailySyncStatus] = useState<IObsidianDailySyncStatus | null>(null);
  const [runningDailySync, setRunningDailySync] = useState(false);

  const filteredNotebooks = useMemo(() => {
    if (!searchQuery.trim()) {
      return notebooks;
    }

    const query = searchQuery.trim().toLowerCase();
    return notebooks.filter((notebook) => notebook.title.toLowerCase().includes(query) || notebook.category.toLowerCase().includes(query));
  }, [notebooks, searchQuery]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/status`);
      const payload = await response.json();
      setStatus(payload);
    } catch {
      Message.error('Failed to fetch system status');
    }
  };

  const fetchNotebooks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/notebook/list`);
      const payload = await response.json();
      setNotebooks(payload.notebooks || []);
    } catch {
      Message.error('Failed to fetch notebooks');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboard = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/analytics/dashboard`);
      const payload = await response.json();
      setDashboard(payload);
    } catch {
      setDashboard(null);
    }
  };

  const fetchGraph = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/graph`);
      const payload = await response.json();
      setGraphNodes(payload.nodes || []);
      setGraphEdges(payload.edges || []);
    } catch {
      setGraphNodes([]);
      setGraphEdges([]);
    }
  };

  const fetchTimeline = async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/timeline`);
      const payload = await response.json();
      setTimelineEvents(payload.events || []);
    } catch {
      setTimelineEvents([]);
    }
  };

  const fetchDailySyncStatus = async () => {
    try {
      const payload = await ipcBridge.obsidianDailySync.status.invoke();
      setDailySyncStatus(payload);
    } catch {
      setDailySyncStatus(null);
    }
  };

  const runDailySyncNow = async () => {
    setRunningDailySync(true);
    try {
      const result = await ipcBridge.obsidianDailySync.runNow.invoke();
      if (result.success) {
        Message.success(result.summary || 'Daily sync completed');
      } else {
        Message.error(result.error || 'Daily sync failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Message.error(message);
    } finally {
      setRunningDailySync(false);
      await fetchDailySyncStatus();
    }
  };

  const searchObsidianVault = async (query: string) => {
    if (!query.trim() || !status?.obsidian_cli_available) {
      setObsidianResults([]);
      return;
    }

    setSearchingVault(true);
    try {
      const result = await ipcBridge.obsidian.searchContent.invoke({
        vault: VAULT_NAME,
        query,
        limit: 20,
      });
      setObsidianResults(result.success ? result.results : []);
    } catch {
      setObsidianResults([]);
    } finally {
      setSearchingVault(false);
    }
  };

  const handleUploadPDF = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace('.pdf', ''));
      formData.append('category', 'research');
      formData.append('run_deep_research', 'false');

      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/pipeline/pdf-full`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();

      if (payload.status === 'success') {
        Message.success(`PDF processed successfully! Notebook ID: ${payload.notebook_id}`);
        await Promise.all([fetchNotebooks(), fetchDashboard(), fetchGraph(), fetchTimeline()]);
      } else {
        Message.error(payload.error || 'Failed to process PDF');
      }
    } catch {
      Message.error('Failed to upload PDF');
    } finally {
      setUploading(false);
    }

    return false;
  };

  const openNotebookInObsidian = async (notebook: Notebook) => {
    const notePath = `active-notebooks/${notebook.title}/study_guide.md`;
    const result = await ipcBridge.obsidian.open.invoke({
      vault: VAULT_NAME,
      path: notePath,
    });

    if (result.success) {
      Message.success('Opened in Obsidian');
    } else {
      Message.error(result.error || 'Failed to open in Obsidian');
    }
  };

  const openSearchResultInObsidian = async (item: ObsidianSearchResult) => {
    const result = await ipcBridge.obsidian.open.invoke({
      vault: VAULT_NAME,
      path: item.path,
    });

    if (result.success) {
      Message.success('Opened in Obsidian');
    } else {
      Message.error(result.error || 'Failed to open note');
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchStatus(), fetchNotebooks(), fetchDashboard(), fetchGraph(), fetchTimeline(), fetchDailySyncStatus()]);
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void searchObsidianVault(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, status?.obsidian_cli_available]);

  return (
    <div style={{ margin: '0 auto', maxWidth: 1400, padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Title heading={3} style={{ margin: 0 }}>
              Knowledge Hub v3.0
            </Title>
            <Paragraph style={{ color: 'var(--color-text-3)', margin: '8px 0 0 0' }}>NotebookLM + Obsidian + PDF 自动化 + Browser Automation + Graph View</Paragraph>
          </div>
          <Space>
            <Upload accept='.pdf' beforeUpload={handleUploadPDF} showUploadList={false}>
              <Button type='primary' icon={<IconUpload />} loading={uploading}>
                上传 PDF
              </Button>
            </Upload>
            <Button icon={<IconRefresh />} onClick={() => void refreshAll()}>
              刷新
            </Button>
          </Space>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <Space direction='vertical' size='small'>
            <Text type='secondary'>Obsidian CLI</Text>
            <Title heading={5} style={{ margin: 0 }}>
              {status?.obsidian_cli_version || 'Loading...'}
            </Title>
            <Badge status={status?.obsidian_cli_available ? 'success' : 'error'} text={status?.obsidian_cli_available ? '可用' : '不可用'} />
          </Space>
        </Card>

        <Card>
          <Space direction='vertical' size='small'>
            <Text type='secondary'>NotebookLM Manager</Text>
            <Title heading={5} style={{ margin: 0 }}>
              {status?.notebooklm_manager_ready ? '就绪' : '未就绪'}
            </Title>
            <Badge status={status?.notebooklm_manager_ready ? 'success' : 'error'} text={status?.notebooklm_manager_ready ? 'Ready' : 'Unavailable'} />
          </Space>
        </Card>

        <Card>
          <Space direction='vertical' size='small'>
            <Text type='secondary'>总 Notebooks</Text>
            <Title heading={5} style={{ margin: 0 }}>
              {status?.total_notebooks || 0}
            </Title>
            <IconBook style={{ color: 'var(--color-primary-6)', fontSize: 24 }} />
          </Space>
        </Card>

        <Card>
          <Space direction='vertical' size='small'>
            <Text type='secondary'>Vault 路径</Text>
            <Title heading={6} style={{ margin: 0, wordBreak: 'break-all' }}>
              {status?.vault_path?.split('/').pop() || 'N/A'}
            </Title>
            <IconFile style={{ color: 'var(--color-primary-6)', fontSize: 24 }} />
          </Space>
        </Card>
      </div>

      <Card>
        <Tabs defaultActiveTab='dashboard'>
          <TabPane key='dashboard' title='Dashboard'>
            <Dashboard data={dashboard} />
          </TabPane>

          <TabPane key='graph' title='Graph View'>
            <KnowledgeGraph nodes={graphNodes} edges={graphEdges} />
          </TabPane>

          <TabPane key='timeline' title='Timeline'>
            <TimelineView events={timelineEvents} />
          </TabPane>

          <TabPane key='notebooks' title='Notebooks'>
            <Input prefix={<IconSearch />} placeholder='Search notebooks by title or category...' value={searchQuery} onChange={setSearchQuery} allowClear className='mb-16px' />

            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Spin />
              </div>
            ) : (
              <>
                {filteredNotebooks.length === 0 && obsidianResults.length === 0 ? (
                  <Empty description={searchQuery ? 'No matching notebooks found' : '暂无 Notebooks'} style={{ padding: 40 }} />
                ) : (
                  <Space direction='vertical' size='large' style={{ width: '100%' }}>
                    {filteredNotebooks.length > 0 && (
                      <div>
                        <Text bold style={{ color: 'var(--color-text-2)', display: 'block', marginBottom: 12 }}>
                          Notebooks ({filteredNotebooks.length})
                        </Text>
                        <List
                          dataSource={filteredNotebooks}
                          render={(item: Notebook) => (
                            <List.Item key={item.notebook_id}>
                              <div style={{ alignItems: 'center', display: 'flex', flex: 1, justifyContent: 'space-between' }}>
                                <div>
                                  <Text bold>{item.title}</Text>
                                  <div style={{ marginTop: 4 }}>
                                    <Tag color='blue' size='small'>
                                      {item.category}
                                    </Tag>
                                    <Tag size='small'>{item.source_count} sources</Tag>
                                    <Text type='secondary' style={{ fontSize: 12, marginLeft: 8 }}>
                                      {new Date(item.created_at).toLocaleDateString('zh-CN')}
                                    </Text>
                                  </div>
                                </div>
                                <Space>
                                  <Button size='small' icon={<IconLaunch />} onClick={() => void openNotebookInObsidian(item)}>
                                    Obsidian
                                  </Button>
                                  <Button size='small' icon={<IconSound />}>
                                    Audio
                                  </Button>
                                  <Button size='small' type='primary'>
                                    查看
                                  </Button>
                                </Space>
                              </div>
                            </List.Item>
                          )}
                        />
                      </div>
                    )}

                    {searchQuery && obsidianResults.length > 0 && (
                      <div>
                        <Text bold style={{ color: 'var(--color-text-2)', display: 'block', marginBottom: 12 }}>
                          Obsidian Vault ({obsidianResults.length})
                          {searchingVault && <Spin size={12} style={{ marginLeft: 8 }} />}
                        </Text>
                        <List
                          dataSource={obsidianResults}
                          render={(item: ObsidianSearchResult) => (
                            <List.Item key={item.path}>
                              <div style={{ alignItems: 'center', display: 'flex', flex: 1, justifyContent: 'space-between' }}>
                                <Text>{item.path}</Text>
                                <Button size='small' type='text' icon={<IconLaunch />} onClick={() => void openSearchResultInObsidian(item)}>
                                  Open
                                </Button>
                              </div>
                            </List.Item>
                          )}
                        />
                      </div>
                    )}
                  </Space>
                )}
              </>
            )}
          </TabPane>

          <TabPane key='upload' title='上传 PDF'>
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Upload drag accept='.pdf' beforeUpload={handleUploadPDF} showUploadList={false}>
                <div style={{ padding: 40 }}>
                  <IconUpload style={{ color: 'var(--color-primary-6)', fontSize: 48 }} />
                  <Title heading={5} style={{ marginTop: 16 }}>
                    拖拽 PDF 文件到此处上传
                  </Title>
                  <Paragraph type='secondary'>自动创建 Notebook + 生成 Artifacts + 同步 Obsidian</Paragraph>
                </div>
              </Upload>
            </div>
          </TabPane>

          <TabPane key='automation-auth' title='NotebookLM 认证'>
            <NotebookLMAuth />
          </TabPane>

          <TabPane key='smart-query' title='智能查询'>
            <SmartQuery />
          </TabPane>

          <TabPane key='dataview' title='Dataview'>
            <DataviewQuery />
          </TabPane>

          <TabPane key='settings' title='设置'>
            <div style={{ padding: 20 }}>
              <Title heading={6}>系统配置</Title>
              <Paragraph>
                <Text bold>Vault 路径: </Text>
                <Text code>{status?.vault_path || 'N/A'}</Text>
              </Paragraph>
              <Paragraph>
                <Text bold>Obsidian CLI: </Text>
                <Text code>{status?.obsidian_cli_version || 'Not installed'}</Text>
              </Paragraph>
              <Paragraph>
                <Text bold>Gateway API: </Text>
                <Text code>{GATEWAY_URL}</Text>
              </Paragraph>

              <Title heading={6} style={{ marginTop: 20 }}>
                Daily Sync
              </Title>
              <Paragraph>
                <Text bold>Vault: </Text>
                <Text code>{dailySyncStatus?.vault || 'N/A'}</Text>
              </Paragraph>
              <Paragraph>
                <Text bold>Schedule: </Text>
                <Text code>{dailySyncStatus?.schedule || 'N/A'}</Text>
              </Paragraph>
              <Paragraph>
                <Text bold>Next Run: </Text>
                <Text code>{formatTimestamp(dailySyncStatus?.nextRunAt)}</Text>
              </Paragraph>
              <Paragraph>
                <Text bold>Last Success: </Text>
                <Text code>{formatTimestamp(dailySyncStatus?.lastSuccessAt)}</Text>
              </Paragraph>
              <Paragraph>
                <Text bold>Last Error: </Text>
                <Text code>{dailySyncStatus?.lastError || 'None'}</Text>
              </Paragraph>

              <Space>
                <Button type='primary' loading={runningDailySync} onClick={() => void runDailySyncNow()}>
                  手动执行 Daily Sync
                </Button>
                <Button onClick={() => void fetchDailySyncStatus()}>刷新 Daily Sync 状态</Button>
              </Space>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default KnowledgeHubPage;
