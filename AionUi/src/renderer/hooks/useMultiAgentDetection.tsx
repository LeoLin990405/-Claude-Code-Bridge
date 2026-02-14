/**
 * Hook for detecting multi-agent mode on application startup
 */

import { ipcBridge } from '@/common';
import { toast } from 'sonner';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const useMultiAgentDetection = (): { contextHolder: React.ReactNode } => {
  const { t } = useTranslation();

  useEffect(() => {
    const checkMultiAgentMode = async () => {
      try {
        const response = await ipcBridge.acpConversation.getAvailableAgents.invoke();
        if (response && response.success && response.data) {
          // 检测是否有多个ACP智能体（不包括内置的Gemini）
          const acpAgents = response.data.filter((agent: { backend: string; name: string; cliPath?: string }) => agent.backend !== 'gemini');
          if (acpAgents.length > 1) {
            toast.success(t('conversation.welcome.multiAgentModeEnabled'));
          }
        }
      } catch (error) {
        // 静默处理错误，避免影响应用启动
        console.log('Multi-agent detection failed:', error);
      }
    };

    checkMultiAgentMode().catch((error) => {
      console.error('Multi-agent detection failed:', error);
    });
  }, []); // 空依赖数组确保只在组件初始化时执行一次

  return { contextHolder: null };
};
