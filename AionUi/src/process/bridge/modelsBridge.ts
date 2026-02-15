import { ipcMain } from 'electron';
import type { UserModelPreferences, AcpBackendAll } from '@/types/acpTypes';
import { getModelsByProvider } from '@/common/models/modelRegistry';
import { ollamaService } from '@/process/services/ollama/OllamaService';
import { ConfigStorage } from '@/common/storage';

export function initModelsBridge(): void {
  const channels = ['models:getModels', 'models:getOllamaModels', 'models:getUserPreferences', 'models:saveUserPreferences', 'models:getDefaultModel'];
  channels.forEach((channel) => {
    ipcMain.removeHandler(channel);
  });
  ipcMain.handle('models:getModels', async (_, params: { provider: AcpBackendAll }) => {
    const provider = params.provider;
    if (provider === 'ollama') {
      const dynamicModels = await ollamaService.listModels();
      if (dynamicModels.length > 0) {
        return dynamicModels;
      }
      return getModelsByProvider('ollama');
    }
    return getModelsByProvider(provider);
  });

  ipcMain.handle('models:getOllamaModels', async () => {
    return await ollamaService.listModels();
  });

  ipcMain.handle('models:getUserPreferences', async () => {
    const config = (await ConfigStorage.get('hivemind.userModelPreferences')) as { selectedModels?: Record<string, string>; lastUpdated?: string } | undefined;
    return {
      selectedModels: config?.selectedModels || {},
      lastUpdated: config?.lastUpdated,
    };
  });

  ipcMain.handle('models:saveUserPreferences', async (_, preferences: UserModelPreferences) => {
    await ConfigStorage.set('hivemind.userModelPreferences', {
      selectedModels: preferences.selectedModels,
      lastUpdated: new Date().toISOString(),
    });
  });

  ipcMain.handle('models:getDefaultModel', async (_, params: { provider: AcpBackendAll }) => {
    const provider = params.provider;
    const models = getModelsByProvider(provider);
    return models.find((m) => m.isDefault) || models[0] || null;
  });
}
