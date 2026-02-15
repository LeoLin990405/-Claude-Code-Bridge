/**
 * @license
 * Copyright 2026 HiveMind (hivemind.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { getAgentTeamsDatabase } from '@process/database/agentTeams';
import { ProviderRouter, providerRouter } from './ProviderRouter';
import { DependencyResolver } from './DependencyResolver';
import { MessageBroker } from './MessageBroker';
import { SessionManager } from './SessionManager';
import { TaskManager } from './TaskManager';
import { TeamCoordinator } from './TeamCoordinator';
import { TaskExecutionRuntime } from './TaskExecutionRuntime';

const agentTeamsDb = getAgentTeamsDatabase();
const dependencyResolver = new DependencyResolver(agentTeamsDb);
const messageBroker = new MessageBroker(agentTeamsDb);
const sessionManager = new SessionManager(agentTeamsDb);
const taskManager = new TaskManager(agentTeamsDb, providerRouter, dependencyResolver);
const teamCoordinator = new TeamCoordinator(agentTeamsDb, taskManager, messageBroker);
const taskExecutionRuntime = new TaskExecutionRuntime(agentTeamsDb, taskManager, teamCoordinator, sessionManager, providerRouter, messageBroker);

export { ProviderRouter, providerRouter, dependencyResolver, messageBroker, sessionManager, taskManager, teamCoordinator, taskExecutionRuntime, agentTeamsDb };

export * from './types';

export * from './providers';
