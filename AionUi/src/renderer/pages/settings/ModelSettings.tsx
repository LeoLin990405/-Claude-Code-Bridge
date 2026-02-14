import React, { useState, useEffect } from 'react';
import { Button } from '@/renderer/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/renderer/components/ui/card';
import { ModelSelector } from '@/renderer/components/ModelSelector';
import type { AcpBackendAll, ModelConfig, UserModelPreferences } from '@/types/acpTypes';
import { RefreshCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SettingsPageWrapper } from './components/SettingsPageWrapper';

const PROVIDERS: Array<{ id: AcpBackendAll; name: string; icon: string }> = [
  { id: 'claude', name: 'Claude Code', icon: '🤖' },
  { id: 'codex', name: 'Codex', icon: '🔮' },
  { id: 'gemini', name: 'Gemini', icon: '💎' },
  { id: 'kimi', name: 'Kimi', icon: '🌙' },
  { id: 'qwen', name: 'Qwen', icon: '🐼' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🌊' },
  { id: 'iflow', name: 'iFlow', icon: '⚡' },
  { id: 'opencode', name: 'OpenCode', icon: '📦' },
  { id: 'ollama', name: 'Ollama', icon: '🦙' },
];

const ModelSettings: React.FC = () => {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<UserModelPreferences>({ selectedModels: {} });
  const [ollamaModels, setOllamaModels] = useState<ModelConfig[]>([]);
  const [refreshingOllama, setRefreshingOllama] = useState(false);

  useEffect(() => {
    loadPreferences();
    refreshOllamaModels();
  }, []);

  const loadPreferences = async () => {
    const prefs = await window.ipcBridge.models.getUserPreferences();
    setPreferences(prefs);
  };

  const refreshOllamaModels = async () => {
    setRefreshingOllama(true);
    try {
      const models = await window.ipcBridge.models.getOllamaModels();
      setOllamaModels(models);
    } catch (err) {
      console.error('Failed to refresh Ollama models:', err);
    } finally {
      setRefreshingOllama(false);
    }
  };

  const handleModelChange = async (provider: AcpBackendAll, modelId: string) => {
    const newPrefs = {
      selectedModels: { ...preferences.selectedModels, [provider]: modelId },
    };
    setPreferences(newPrefs);
    await window.ipcBridge.models.saveUserPreferences(newPrefs);
  };

  return (
    <SettingsPageWrapper>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.model', { defaultValue: 'Model Settings' })}</h1>
          <p className="text-muted-foreground mt-2">
            {t('settings.modelDescription', { defaultValue: 'Select default models for each AI provider' })}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">{provider.icon}</span>
                  <span>{provider.name}</span>
                </CardTitle>
                <CardDescription>
                  {t(`settings.${provider.id}ModelDescription`, { defaultValue: `Select model for ${provider.name}` })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ModelSelector
                    provider={provider.id}
                    value={preferences.selectedModels[provider.id]}
                    onChange={(modelId) => handleModelChange(provider.id, modelId)}
                    className="flex-1"
                  />
                  {provider.id === 'ollama' && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={refreshOllamaModels}
                      disabled={refreshingOllama}
                    >
                      <RefreshCcw className={refreshingOllama ? 'animate-spin' : ''} />
                    </Button>
                  )}
                </div>
                {provider.id === 'ollama' && ollamaModels.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {ollamaModels.length} models detected
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </SettingsPageWrapper>
  );
};

export default ModelSettings;
