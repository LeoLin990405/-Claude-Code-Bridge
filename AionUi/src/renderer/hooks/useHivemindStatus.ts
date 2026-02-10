/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import type { GatewayStatus, HivemindProviderStatus } from '@/agent/hivemind/types';

const MAX_RETRIES = 5;
const MAX_BACKOFF_MS = 30000;

export function useHivemindStatus(gatewayUrl = 'http://localhost:8765') {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${gatewayUrl}/api/status`);
      if (!res.ok) {
        setConnected(false);
        setError(`HTTP ${res.status}`);
        return;
      }

      const data = (await res.json()) as GatewayStatus;
      setStatus(data);
      setConnected(true);
      setError(null);
      setRetryCount(0);
      setReconnecting(false);
    } catch (err) {
      setConnected(false);
      setError(err instanceof Error ? err.message : 'Gateway unreachable');
    }
  }, [gatewayUrl]);

  // Normal polling
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 10000);

    return () => {
      clearInterval(timer);
    };
  }, [refresh]);

  // Auto-reconnect with exponential backoff
  useEffect(() => {
    if (connected || retryCount >= MAX_RETRIES) {
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, retryCount), MAX_BACKOFF_MS);
    const timer = setTimeout(() => {
      setReconnecting(true);
      void refresh().finally(() => {
        setRetryCount((prev) => prev + 1);
        setReconnecting(false);
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [connected, retryCount, refresh]);

  const getProviderStatus = useCallback(
    (providerName: string): HivemindProviderStatus | undefined => {
      return status?.providers?.find((p) => p.name === providerName);
    },
    [status]
  );

  return {
    status,
    connected,
    error,
    reconnecting,
    refresh,
    getProviderStatus,
    providers: status?.providers ?? [],
  };
}
