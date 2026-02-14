import { ipcMain } from 'electron';
import type { ModelConfig, UserModelPreferences, AcpBackendAll } from '@/types/acpTypes';
import { getModelsByProvider, getDefaultModelId } from '@/common/models/modelRegistry';
import { ollamaService } from '@/process/services/ollama/OllamaService';
import { ConfigStorage } from '@/common/storage';

const USER_PREFERENCES_KEY = 'hivemind.userModelPreferences';

export function initModelsBridge(): void {
  ipcMain.handle('models:getModels', async (_, provider: AcpBackendAll) => {
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
    const config = await ConfigStorage.get();
    const prefs = config[USER_PREFERENCES_KEY];
    return {
      selectedModels: prefs?.selectedModels || {},
      lastUpdated: prefs?.lastUpdated,
    };
  });

  ipcMain.handle('models:saveUserPreferences', async (_, preferences: UserModelPreferences) => {
    const config = await ConfigStorage.get();
    config[USER_PREFERENCES_KEY] = {
      selectedModels: preferences.selectedModels,
      lastUpdated: new Date().toISOString(),
    };
    await ConfigStorage.set(config);
  });

  ipcMain.handle('models:getDefaultModel', async (_, provider: AcpBackendAll) => {
    const models = getModelsByProvider(provider);
    const defaultId = getDefaultModelId(provider);
    if (defaultId) {
      return models.find((m) => m.id === defaultId) || null;
    }
    return models.find((m) => m.isDefault) || models[0] || null;
  });
}
