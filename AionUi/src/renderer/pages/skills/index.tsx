/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Message, Select, Space, Spin, Typography } from '@arco-design/web-react';
import type { IAITool, ISkill, ISyncResult } from '@/common/ipcBridge';
import { skillsApi } from './api';
import { SkillCard, SyncStatusBadge, ToolsPanel } from './components';

const { Title } = Typography;

const buildSyncFailureMessage = (failed: ISyncResult[]): string => {
  const toolMissingCount = failed.filter((item) => item.error === 'Tool not detected').length;
  const otherErrors = failed
    .filter((item) => item.error && item.error !== 'Tool not detected')
    .slice(0, 2)
    .map((item) => item.error as string);

  if (toolMissingCount > 0 && otherErrors.length === 0) {
    return `${toolMissingCount} mapping(s) skipped because tools were not detected. Run Detect Tools first.`;
  }

  const detail = otherErrors.length > 0 ? ` Details: ${otherErrors.join(' | ')}` : '';
  return `${failed.length} mapping(s) failed during sync.${detail}`;
};

const SkillsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [skills, setSkills] = useState<ISkill[]>([]);
  const [tools, setTools] = useState<IAITool[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [syncStatus, setSyncStatus] = useState({ totalSkills: 0, syncedSkills: 0, errors: 0 });

  const categoryOptions = useMemo(
    () => [
      { label: 'All', value: 'all' },
      { label: 'custom', value: 'custom' },
      { label: 'claude-code', value: 'claude-code' },
      { label: 'codex', value: 'codex' },
      { label: 'opencode', value: 'opencode' },
    ],
    []
  );

  const refresh = async () => {
    setLoading(true);
    try {
      const [nextSkills, nextTools, status] = await Promise.all([skillsApi.listSkills(category === 'all' ? undefined : category), skillsApi.listTools(), skillsApi.syncStatus()]);
      setSkills(nextSkills);
      setTools(nextTools);
      setSyncStatus(status);
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [category]);

  const detectTools = async () => {
    setDetecting(true);
    try {
      const nextTools = await skillsApi.detectTools();
      setTools(nextTools);

      const detectedCount = nextTools.filter((tool) => tool.detected).length;
      if (detectedCount === 0) {
        Message.warning('No AI tools detected. Check your local tool config paths.');
      } else {
        Message.success(`Tool detection finished (${detectedCount}/${nextTools.length} detected)`);
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDetecting(false);
    }
  };

  const syncAll = async () => {
    setSyncing(true);
    try {
      const results = await skillsApi.syncAll();
      const failed = results.filter((item) => !item.success);
      if (failed.length > 0) {
        Message.warning(buildSyncFailureMessage(failed));
      } else {
        Message.success('All enabled mappings synced');
      }
      setSyncStatus(await skillsApi.syncStatus());
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  };

  const deleteSkill = async (skill: ISkill) => {
    try {
      await skillsApi.deleteSkill(skill.id);
      Message.success('Skill deleted');
      await refresh();
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  const toggleToolEnabled = async (tool: IAITool, enabled: boolean) => {
    try {
      await skillsApi.setToolEnabled(tool.id, enabled);
      setTools((prev) => prev.map((item) => (item.id === tool.id ? { ...item, enabled: enabled ? 1 : 0 } : item)));
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 0' }}>
        <Spin />
      </div>
    );
  }

  return (
    <Space direction='vertical' size='large' style={{ width: '100%' }}>
      <Card>
        <Space align='center' style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title heading={5} style={{ margin: 0 }}>
            Skills Manager
          </Title>
          <Space>
            <SyncStatusBadge {...syncStatus} />
            <Select style={{ width: 180 }} value={category} onChange={(value) => setCategory(String(value))} options={categoryOptions} />
            <Button onClick={() => void refresh()}>Refresh</Button>
            <Button onClick={() => void syncAll()} loading={syncing} status='success'>
              Sync All
            </Button>
            <Button type='primary' onClick={() => void navigate('/skills/new')}>
              New Skill
            </Button>
          </Space>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        <ToolsPanel tools={tools} onDetect={() => void detectTools()} onToggleEnabled={(tool, enabled) => void toggleToolEnabled(tool, enabled)} detecting={detecting} />

        <Card title={`Skills (${skills.length})`}>
          <Space direction='vertical' style={{ width: '100%' }}>
            {skills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onEdit={() => void navigate(`/skills/${skill.id}`)} onDelete={(item) => void deleteSkill(item)} />
            ))}
            {skills.length === 0 ? <div style={{ color: 'var(--color-text-3)' }}>No skills yet</div> : null}
          </Space>
        </Card>
      </div>
    </Space>
  );
};

export default SkillsPage;
