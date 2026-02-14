/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/renderer/components/ui/card';
import { Badge } from '@/renderer/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/renderer/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/renderer/components/ui/table';
import { motion } from 'framer-motion';
import type { IAgentCostAnalysis, IAgentTeam, IAgentTeamStats } from '@/common/ipcBridge';
import { agentTeamsApi } from './api';
import { CostChart } from './components';
import { Typography } from '@/renderer/components/atoms/Typography';

const AnalyticsPage: React.FC = () => {
  const [teams, setTeams] = useState<IAgentTeam[]>([]);
  const [teamId, setTeamId] = useState<string>('');
  const [stats, setStats] = useState<IAgentTeamStats | null>(null);
  const [cost, setCost] = useState<IAgentCostAnalysis | null>(null);

  const refresh = async (selectedTeamId: string) => {
    if (!selectedTeamId) {
      return;
    }

    const [nextStats, nextCost] = await Promise.all([agentTeamsApi.getTeamStats(selectedTeamId), agentTeamsApi.getCostAnalysis(selectedTeamId)]);
    setStats(nextStats);
    setCost(nextCost);
  };

  useEffect(() => {
    void (async () => {
      const nextTeams = await agentTeamsApi.listTeams();
      setTeams(nextTeams);
      if (nextTeams.length > 0) {
        setTeamId(nextTeams[0].id);
      }
    })();
  }, []);

  useEffect(() => {
    if (teamId) {
      void refresh(teamId);
    }
  }, [teamId]);

  const providerRows = useMemo(() => {
    if (!cost) {
      return [];
    }

    return Object.entries(cost.by_provider).map(([provider, row]) => ({ provider, ...row }));
  }, [cost]);

  const modelRows = useMemo(() => {
    if (!cost) {
      return [];
    }

    return Object.entries(cost.by_model).map(([model, row]) => ({ model, ...row }));
  }, [cost]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ padding: '24px' }}
    >
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" bold>Analytics</Typography>
          <Typography variant="body2" color="secondary">Cost and performance analysis for AI teams</Typography>
        </div>
        <Card>
          <CardContent className="py-2 px-4">
            <div className="flex items-center gap-2">
              <Typography variant="body2" bold>Team:</Typography>
              <Select
                value={teamId}
                onValueChange={setTeamId}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-6 w-full">
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div><Typography variant="caption" color="secondary">Total Tasks</Typography><Typography variant="h4" bold>{stats?.total_tasks || 0}</Typography></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div><Typography variant="caption" color="secondary">Completed</Typography><Typography variant="h4" bold style={{ color: 'var(--color-success)' }}>{stats?.completed_tasks || 0}</Typography></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div><Typography variant="caption" color="secondary">Failed</Typography><Typography variant="h4" bold style={{ color: 'var(--color-error)' }}>{stats?.failed_tasks || 0}</Typography></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div><Typography variant="caption" color="secondary">Total Cost (USD)</Typography><Typography variant="h4" bold style={{ color: 'var(--color-warning)' }}>{(cost?.total_cost_usd || 0).toFixed(4)}</Typography></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              <Typography variant="h6">Cost by Provider (Chart)</Typography>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostChart cost={cost} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Typography variant="h6">Cost by Provider</Typography>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Input Tokens</TableHead>
                  <TableHead>Output Tokens</TableHead>
                  <TableHead>Cost (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providerRows.map((row) => (
                  <TableRow key={row.provider}>
                    <TableCell>
                      <Badge variant="default">{row.provider}</Badge>
                    </TableCell>
                    <TableCell>{row.tasks_count}</TableCell>
                    <TableCell>{row.input_tokens}</TableCell>
                    <TableCell>{row.output_tokens}</TableCell>
                    <TableCell>
                      <Typography color="warning" bold>${row.cost_usd.toFixed(4)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Typography variant="h6">Cost by Model</Typography>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Tasks</TableHead>
                  <TableHead>Input Tokens</TableHead>
                  <TableHead>Output Tokens</TableHead>
                  <TableHead>Cost (USD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelRows.map((row) => (
                  <TableRow key={row.model}>
                    <TableCell>
                      <Badge variant="outline">{row.model}</Badge>
                    </TableCell>
                    <TableCell>{row.tasks_count}</TableCell>
                    <TableCell>{row.input_tokens}</TableCell>
                    <TableCell>{row.output_tokens}</TableCell>
                    <TableCell>
                      <Typography color="warning" bold>${row.cost_usd.toFixed(4)}</Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default AnalyticsPage;
