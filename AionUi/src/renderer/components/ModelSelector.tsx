import React, { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/renderer/components/ui/select';
import type { ModelConfig, AcpBackendAll } from '@/types/acpTypes';

interface ModelSelectorProps {
  provider: AcpBackendAll;
  value?: string;
  onChange?: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  provider,
  value,
  onChange,
  disabled = false,
  className = '',
}) => {
  const [models, setModels] = useState<ModelConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(value || '');

  useEffect(() => {
    loadModels();
  }, [provider]);

  useEffect(() => {
    if (value) {
      setSelectedModel(value);
    }
  }, [value]);

  const loadModels = async () => {
    setLoading(true);
    try {
      const modelList = await window.ipcBridge.models.getModels(provider);
      setModels(modelList);

      if (!selectedModel && modelList.length > 0) {
        const defaultModel = modelList.find((m) => m.isDefault) || modelList[0];
        setSelectedModel(defaultModel.id);
        onChange?.(defaultModel.id);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (modelId: string) => {
    setSelectedModel(modelId);
    onChange?.(modelId);
  };

  const currentModel = models.find((m) => m.id === selectedModel);

  return (
    <div className={className}>
      <Select value={selectedModel} onValueChange={handleChange} disabled={disabled || loading}>
        <SelectTrigger className="w-full min-w-[180px]">
          <SelectValue placeholder={loading ? 'Loading...' : 'Select model'} />
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center justify-between w-full">
                <span>{model.displayName}</span>
                {model.isDefault && (
                  <span className="ml-2 text-xs text-muted-foreground">(Default)</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
