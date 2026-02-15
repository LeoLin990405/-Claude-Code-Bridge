/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import MonacoEditor from '@monaco-editor/react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Input, Message, Space, Spin, Tag, Typography } from '@arco-design/web-react';
import type { IAITool } from '@/common/ipcBridge';
import { skillsApi } from './api';

const { Title, Text } = Typography;

const DEFAULT_SKILL_CONTENT = `# Skill Title\n\nDescribe what this skill does.\n\n## Triggers\n- keyword-1\n- keyword-2\n\n## Steps\n1. Step one\n2. Step two\n`;

const SkillEditor: React.FC = () => {
  const { skillId } = useParams<{ skillId: string }>();
  const navigate = useNavigate();
  const isCreate = !skillId || skillId === 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tools, setTools] = useState<IAITool[]>([]);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [content, setContent] = useState(DEFAULT_SKILL_CONTENT);
  const [form] = Form.useForm();

  const refresh = async () => {
    setLoading(true);
    try {
      const toolList = await skillsApi.listTools();
      setTools(toolList);

      if (isCreate) {
        form.setFieldsValue({
          name: '',
          category: 'custom',
          description: '',
          tags: '',
        });
        setEnabledTools(toolList.filter((tool) => tool.detected && tool.enabled).map((tool) => tool.id));
        setContent(DEFAULT_SKILL_CONTENT);
      } else if (skillId) {
        const detail = await skillsApi.getSkill(skillId);
        form.setFieldsValue({
          name: detail.name,
          category: detail.category,
          description: detail.description || '',
          tags: (detail.tags || []).join(','),
        });
        setEnabledTools(detail.enabled_tools || []);
        setContent(detail.content || DEFAULT_SKILL_CONTENT);
      }
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [skillId]);

  const toggleTool = (toolId: string, enabled: boolean) => {
    setEnabledTools((prev) => {
      if (enabled) {
        return Array.from(new Set([...prev, toolId]));
      }
      return prev.filter((id) => id !== toolId);
    });
  };

  const saveSkill = async () => {
    setSaving(true);
    try {
      const values = await form.validate();
      const tags = String(values.tags || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (isCreate) {
        await skillsApi.createSkill({
          name: values.name,
          category: values.category,
          description: values.description,
          content,
          enabled_tools: enabledTools,
          tags,
        });
        Message.success('Skill created');
      } else if (skillId) {
        await skillsApi.updateSkill(skillId, {
          description: values.description,
          content,
          enabled_tools: enabledTools,
          tags,
        });
        Message.success('Skill updated');
      }

      await navigate('/skills');
    } catch (error) {
      if (error instanceof Error) {
        Message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteSkill = async () => {
    if (isCreate || !skillId) {
      return;
    }

    setDeleting(true);
    try {
      await skillsApi.deleteSkill(skillId);
      Message.success('Skill deleted');
      await navigate('/skills');
    } catch (error) {
      Message.error(error instanceof Error ? error.message : String(error));
    } finally {
      setDeleting(false);
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
        <Space align='center' style={{ justifyContent: 'space-between', width: '100%' }}>
          <Title heading={5} style={{ margin: 0 }}>
            {isCreate ? 'Create Skill' : 'Edit Skill'}
          </Title>
          <Space>
            <Button onClick={() => void navigate('/skills')}>Back</Button>
            {!isCreate ? (
              <Button status='danger' loading={deleting} onClick={() => void deleteSkill()}>
                Delete
              </Button>
            ) : null}
            <Button type='primary' loading={saving} onClick={() => void saveSkill()}>
              Save
            </Button>
          </Space>
        </Space>
      </Card>

      <Card>
        <Form form={form} layout='vertical'>
          <Form.Item field='name' label='Name' rules={[{ required: true }]}>
            <Input disabled={!isCreate} placeholder='e.g. pdf' />
          </Form.Item>
          <Form.Item field='category' label='Category' rules={[{ required: true }]}>
            <Input disabled={!isCreate} placeholder='custom / claude-code / codex / opencode' />
          </Form.Item>
          <Form.Item field='description' label='Description'>
            <Input placeholder='Skill description' />
          </Form.Item>
          <Form.Item field='tags' label='Tags'>
            <Input placeholder='comma,separated,tags' />
          </Form.Item>
        </Form>
      </Card>

      <Card title='SKILL.md'>
        <div style={{ height: '60vh' }}>
          <MonacoEditor
            height='100%'
            language='markdown'
            value={content}
            onChange={(value) => setContent(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              wordWrap: 'on',
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      </Card>

      <Card title='Enable for Tools'>
        <Space wrap>
          {tools.map((tool) => {
            const checked = enabledTools.includes(tool.id);
            return (
              <Button key={tool.id} type={checked ? 'primary' : 'default'} onClick={() => toggleTool(tool.id, !checked)}>
                {tool.display_name}
              </Button>
            );
          })}
        </Space>
        <div style={{ marginTop: 12 }}>
          {tools.map((tool) => (
            <Tag key={tool.id} color={tool.detected ? 'green' : 'red'} style={{ marginBottom: 6 }}>
              {tool.display_name}: {tool.detected ? 'detected' : 'missing'}
            </Tag>
          ))}
          <Text type='secondary' style={{ display: 'block' }}>
            Disabled or missing tools will not receive symlink sync.
          </Text>
        </div>
      </Card>
    </Space>
  );
};

export default SkillEditor;
