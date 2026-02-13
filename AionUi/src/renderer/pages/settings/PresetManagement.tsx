import { Button } from '@/renderer/components/ui/button';
import { Input } from '@/renderer/components/ui/input';
import { LegacyModal } from '@/renderer/components/ui/legacy-modal';
import { Typography } from '@/renderer/components/atoms/Typography';
import { EditTwo, Delete, Lightning } from '@icon-park/react';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { mutate } from 'swr';
import { ConfigStorage } from '@/common/storage';
import type { AcpBackendConfig } from '@/types/acpTypes';
import { acpConversation } from '@/common/ipcBridge';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { useThemeContext } from '@/renderer/context/ThemeContext';

interface PresetManagementProps {
  message: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
}

const PresetManagement: React.FC<PresetManagementProps> = ({ message }) => {
  const { t } = useTranslation();
  const { theme } = useThemeContext();
  const [presets, setPresets] = useState<AcpBackendConfig[]>([]);
  const [editingPreset, setEditingAgent] = useState<AcpBackendConfig | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<AcpBackendConfig | null>(null);

  // Form state
  const [editName, setEditName] = useState('');
  const [editContext, setEditContext] = useState('');

  const loadPresets = useCallback(async () => {
    try {
      const agents = await ConfigStorage.get('acp.customAgents');
      if (agents && Array.isArray(agents)) {
        setPresets(agents.filter((a) => a.isPreset));
      }
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }, []);

  useEffect(() => {
    void loadPresets();
  }, [loadPresets]);

  const refreshAgentDetection = useCallback(async () => {
    try {
      await acpConversation.refreshCustomAgents.invoke();
      await mutate('acp.agents.available');
    } catch {
      // ignore
    }
  }, []);

  const handleEdit = (preset: AcpBackendConfig) => {
    setEditingAgent(preset);
    setEditName(preset.name);
    setEditContext(preset.context || '');
    setEditVisible(true);
  };

  const handleSave = async () => {
    if (!editingPreset) return;
    try {
      const allAgents = (await ConfigStorage.get('acp.customAgents')) || [];
      const updatedAgents = allAgents.map((a) => (a.id === editingPreset.id ? { ...a, name: editName, context: editContext } : a));
      await ConfigStorage.set('acp.customAgents', updatedAgents);
      setEditVisible(false);
      message.success(t('common.success', { defaultValue: 'Success' }));
      void loadPresets();
      void refreshAgentDetection();
    } catch (error) {
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  const handleDelete = async () => {
    if (!presetToDelete) return;
    try {
      const allAgents = (await ConfigStorage.get('acp.customAgents')) || [];
      const updatedAgents = allAgents.filter((a) => a.id !== presetToDelete.id);
      await ConfigStorage.set('acp.customAgents', updatedAgents);
      setDeleteVisible(false);
      message.success(t('common.success', { defaultValue: 'Deleted' }));
      void loadPresets();
      void refreshAgentDetection();
    } catch (error) {
      message.error(t('common.failed', { defaultValue: 'Failed' }));
    }
  };

  return (
    <div className="py-2">
      {presets.length === 0 ? (
        <div className="text-center py-4 text-t-secondary">{t('settings.no_presets', { defaultValue: 'No custom presets generated yet.' })}</div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div key={preset.id} className="p-4 bg-fill-2 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightning theme='filled' fill='var(--color-primary-6)' />
                  <div className="font-medium">{preset.name}</div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleEdit(preset)}
                  >
                    <EditTwo size={'14'} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setPresetToDelete(preset);
                      setDeleteVisible(true);
                    }}
                  >
                    <Delete size={'14'} />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-t-secondary mt-2 truncate max-w-[400px]">{preset.context?.substring(0, 100)}...</div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <LegacyModal
        title={t('settings.edit_preset', { defaultValue: 'Edit Preset' })}
        visible={editVisible}
        onOk={handleSave}
        onCancel={() => setEditVisible(false)}
        width={600}
      >
        <div className="space-y-4">
          <div>
            <Typography variant="body2" bold>{t('settings.agent_name', { defaultValue: 'Agent Name' })}</Typography>
            <Input 
              className="mt-2" 
              value={editName} 
              onChange={(e) => setEditName(e.target.value)} 
            />
          </div>
          <div>
            <Typography variant="body2" bold>{t('settings.rule_content', { defaultValue: 'Rule Content / Instructions' })}</Typography>
            <div className="mt-2 border rounded overflow-hidden">
              <CodeMirror 
                value={editContext} 
                height="300px" 
                theme={theme} 
                extensions={[markdown()]} 
                onChange={setEditContext} 
              />
            </div>
          </div>
        </div>
      </LegacyModal>

      {/* Delete Confirm */}
      <LegacyModal
        title={t('common.confirm', { defaultValue: 'Confirm Delete' })}
        visible={deleteVisible}
        onOk={handleDelete}
        onCancel={() => setDeleteVisible(false)}
      >
        <p>{t('settings.delete_preset_confirm', { defaultValue: 'Are you sure you want to delete this preset?' })}</p>
        <Typography variant="body2" bold>{presetToDelete?.name}</Typography>
      </LegacyModal>
    </div>
  );
};

export default PresetManagement;
