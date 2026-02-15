/**
 * Knowledge Hub v3.0 - Main Page
 *
 * Unified interface for NotebookLM + Obsidian + PDF Pipeline + Browser Automation + Visualization.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { Badge } from '@/renderer/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/renderer/components/ui/tabs';
import { Book, FileText, ExternalLink, RefreshCw, Search, Volume2, Upload } from 'lucide-react';
import { ipcBridge } from '@/common';
import type { IObsidianDailySyncStatus } from '@/common/ipcBridge';
import KnowledgeGraph, { type KnowledgeGraphEdge, type KnowledgeGraphNode } from '@/renderer/components/KnowledgeGraph';
import TimelineView, { type TimelineEvent } from '@/renderer/components/TimelineView';
import Dashboard, { type DashboardSnapshot } from './Dashboard';
import NotebookLMAuth from './NotebookLMAuth';
import SmartQuery from './SmartQuery';
import DataviewQuery from './DataviewQuery';

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
      console.error('Failed to fetch system status');
    }
  };

  const fetchNotebooks = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${GATEWAY_URL}/knowledge/v2/notebook/list`);
      const payload = await response.json();
      setNotebooks(payload.notebooks || []);
    } catch {
      console.error('Failed to fetch notebooks');
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
      if (!result.success) {
        console.error(result.error || 'Daily sync failed');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
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
        await Promise.all([fetchNotebooks(), fetchDashboard(), fetchGraph(), fetchTimeline()]);
      } else {
        console.error(payload.error || 'Failed to process PDF');
      }
    } catch {
      console.error('Failed to upload PDF');
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

    if (!result.success) {
      console.error(result.error || 'Failed to open in Obsidian');
    }
  };

  const openSearchResultInObsidian = async (item: ObsidianSearchResult) => {
    const result = await ipcBridge.obsidian.open.invoke({
      vault: VAULT_NAME,
      path: item.path,
    });

    if (!result.success) {
      console.error(result.error || 'Failed to open note');
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
    <div className='hive-knowledge-page'>
      <div className='hive-knowledge-header'>
        <div className='hive-knowledge-header__inner'>
          <div>
            <h1 className='text-2xl font-bold m-0'>Knowledge Hub v3.0</h1>
            <p className='text-muted-foreground mt-2'>NotebookLM + Obsidian + PDF 自动化 + Browser Automation + Graph View</p>
          </div>
          <div className='flex gap-2'>
            <label className='cursor-pointer'>
              <input
                type='file'
                accept='.pdf'
                className='hidden'
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUploadPDF(file);
                }}
              />
              <Button disabled={uploading} className='gap-2'>
                <Upload size={16} />
                {uploading ? '上传中...' : '上传 PDF'}
              </Button>
            </label>
            <Button variant='outline' onClick={() => void refreshAll()} className='gap-2'>
              <RefreshCw size={16} />
              刷新
            </Button>
          </div>
        </div>
      </div>

      <div className='hive-knowledge-stats-grid'>
        <Card className='hive-knowledge-card'>
          <CardContent className='pt-6 space-y-2'>
            <div className='text-sm text-muted-foreground'>Obsidian CLI</div>
            <div className='text-xl font-bold'>{status?.obsidian_cli_version || 'Loading...'}</div>
            <Badge variant={status?.obsidian_cli_available ? 'default' : 'destructive'}>{status?.obsidian_cli_available ? '可用' : '不可用'}</Badge>
          </CardContent>
        </Card>

        <Card className='hive-knowledge-card'>
          <CardContent className='pt-6 space-y-2'>
            <div className='text-sm text-muted-foreground'>NotebookLM Manager</div>
            <div className='text-xl font-bold'>{status?.notebooklm_manager_ready ? '就绪' : '未就绪'}</div>
            <Badge variant={status?.notebooklm_manager_ready ? 'default' : 'destructive'}>{status?.notebooklm_manager_ready ? 'Ready' : 'Unavailable'}</Badge>
          </CardContent>
        </Card>

        <Card className='hive-knowledge-card'>
          <CardContent className='pt-6 space-y-2'>
            <div className='text-sm text-muted-foreground'>总 Notebooks</div>
            <div className='text-xl font-bold'>{status?.total_notebooks || 0}</div>
            <Book className='h-6 w-6 text-primary' />
          </CardContent>
        </Card>

        <Card className='hive-knowledge-card'>
          <CardContent className='pt-6 space-y-2'>
            <div className='text-sm text-muted-foreground'>Vault 路径</div>
            <div className='text-xl font-bold break-all'>{status?.vault_path?.split('/').pop() || 'N/A'}</div>
            <FileText className='h-6 w-6 text-primary' />
          </CardContent>
        </Card>
      </div>

      <Card className='hive-knowledge-card'>
        <CardContent className='p-0'>
          <Tabs defaultValue='dashboard'>
            <TabsList className='hive-knowledge-tabs px-4 pt-2'>
              <TabsTrigger value='dashboard'>Dashboard</TabsTrigger>
              <TabsTrigger value='graph'>Graph View</TabsTrigger>
              <TabsTrigger value='timeline'>Timeline</TabsTrigger>
              <TabsTrigger value='notebooks'>Notebooks</TabsTrigger>
              <TabsTrigger value='upload'>上传 PDF</TabsTrigger>
              <TabsTrigger value='automation-auth'>NotebookLM 认证</TabsTrigger>
              <TabsTrigger value='smart-query'>智能查询</TabsTrigger>
              <TabsTrigger value='dataview'>Dataview</TabsTrigger>
              <TabsTrigger value='settings'>设置</TabsTrigger>
            </TabsList>

            <TabsContent value='dashboard'>
              <Dashboard data={dashboard} />
            </TabsContent>

            <TabsContent value='graph'>
              <KnowledgeGraph nodes={graphNodes} edges={graphEdges} />
            </TabsContent>

            <TabsContent value='timeline'>
              <TimelineView events={timelineEvents} />
            </TabsContent>

            <TabsContent value='notebooks'>
              <div className='hive-knowledge-tab-body p-4'>
                <div className='relative mb-4'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                  <Input placeholder='Search notebooks by title or category...' value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className='pl-10' />
                </div>

                {loading ? (
                  <div className='flex items-center justify-center py-10'>
                    <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary'></div>
                  </div>
                ) : (
                  <>
                    {filteredNotebooks.length === 0 && obsidianResults.length === 0 ? (
                      <div className='flex items-center justify-center py-10 text-muted-foreground'>{searchQuery ? 'No matching notebooks found' : '暂无 Notebooks'}</div>
                    ) : (
                      <div className='space-y-6'>
                        {filteredNotebooks.length > 0 && (
                          <div>
                            <div className='text-sm font-medium text-muted-foreground mb-3'>Notebooks ({filteredNotebooks.length})</div>
                            <div className='space-y-2'>
                              {(filteredNotebooks as Notebook[]).map((item) => (
                                <div key={item.notebook_id} className='flex items-center justify-between p-3 border rounded-md'>
                                  <div>
                                    <div className='font-medium'>{item.title}</div>
                                    <div className='mt-1 flex gap-2'>
                                      <Badge variant='default'>{item.category}</Badge>
                                      <Badge variant='outline'>{item.source_count} sources</Badge>
                                      <span className='text-xs text-muted-foreground'>{new Date(item.created_at).toLocaleDateString('zh-CN')}</span>
                                    </div>
                                  </div>
                                  <div className='flex gap-2'>
                                    <Button size='sm' variant='outline' onClick={() => void openNotebookInObsidian(item)} className='gap-1'>
                                      <ExternalLink size={14} />
                                      Obsidian
                                    </Button>
                                    <Button size='sm' variant='outline' className='gap-1'>
                                      <Volume2 size={14} />
                                      Audio
                                    </Button>
                                    <Button size='sm'>查看</Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {searchQuery && obsidianResults.length > 0 && (
                          <div>
                            <div className='text-sm font-medium text-muted-foreground mb-3'>
                              Obsidian Vault ({obsidianResults.length}){searchingVault && <span className='ml-2'>...</span>}
                            </div>
                            <div className='space-y-2'>
                              {(obsidianResults as ObsidianSearchResult[]).map((item) => (
                                <div key={item.path} className='flex items-center justify-between p-3 border rounded-md'>
                                  <span>{item.path}</span>
                                  <Button size='sm' variant='ghost' onClick={() => void openSearchResultInObsidian(item)} className='gap-1'>
                                    <ExternalLink size={14} />
                                    Open
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value='upload'>
              <div className='hive-knowledge-upload p-10 text-center border-2 border-dashed border-muted rounded-lg m-4'>
                <label className='cursor-pointer block'>
                  <input
                    type='file'
                    accept='.pdf'
                    className='hidden'
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUploadPDF(file);
                    }}
                  />
                  <Upload className='h-12 w-12 text-primary mx-auto mb-4' />
                  <h3 className='text-lg font-medium mb-2'>拖拽 PDF 文件到此处上传</h3>
                  <p className='text-muted-foreground'>自动创建 Notebook + 生成 Artifacts + 同步 Obsidian</p>
                </label>
              </div>
            </TabsContent>

            <TabsContent value='automation-auth'>
              <NotebookLMAuth />
            </TabsContent>

            <TabsContent value='smart-query'>
              <SmartQuery />
            </TabsContent>

            <TabsContent value='dataview'>
              <DataviewQuery />
            </TabsContent>

            <TabsContent value='settings'>
              <div className='hive-knowledge-settings p-5'>
                <h3 className='text-lg font-medium mb-4'>系统配置</h3>
                <p className='mb-2'>
                  <span className='font-medium'>Vault 路径: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{status?.vault_path || 'N/A'}</code>
                </p>
                <p className='mb-2'>
                  <span className='font-medium'>Obsidian CLI: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{status?.obsidian_cli_version || 'Not installed'}</code>
                </p>
                <p className='mb-2'>
                  <span className='font-medium'>Gateway API: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{GATEWAY_URL}</code>
                </p>

                <h3 className='text-lg font-medium mt-6 mb-4'>Daily Sync</h3>
                <p className='mb-2'>
                  <span className='font-medium'>Vault: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{dailySyncStatus?.vault || 'N/A'}</code>
                </p>
                <p className='mb-2'>
                  <span className='font-medium'>Schedule: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{dailySyncStatus?.schedule || 'N/A'}</code>
                </p>
                <p className='mb-2'>
                  <span className='font-medium'>Next Run: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{formatTimestamp(dailySyncStatus?.nextRunAt)}</code>
                </p>
                <p className='mb-2'>
                  <span className='font-medium'>Last Success: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{formatTimestamp(dailySyncStatus?.lastSuccessAt)}</code>
                </p>
                <p className='mb-4'>
                  <span className='font-medium'>Last Error: </span>
                  <code className='bg-muted px-2 py-1 rounded'>{dailySyncStatus?.lastError || 'None'}</code>
                </p>

                <div className='flex gap-2'>
                  <Button onClick={() => void runDailySyncNow()} disabled={runningDailySync}>
                    {runningDailySync ? '执行中...' : '手动执行 Daily Sync'}
                  </Button>
                  <Button variant='outline' onClick={() => void fetchDailySyncStatus()}>
                    刷新 Daily Sync 状态
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default KnowledgeHubPage;
