/**
 * CCB Gateway Dashboard - Internationalization
 * Extracted from index.html for modular maintenance
 */

const i18n = {
    en: {
        // Header
        connected: 'Connected', disconnected: 'Disconnected', uptime: 'Uptime', switchLang: 'Switch Language',
        // Tabs
        dashboard: 'Dashboard', requests: 'Requests', test: 'Test', compare: 'Compare', keys: 'API Keys', config: 'Config',
        // Dashboard cards
        totalRequests: 'Total Requests', allTime: 'All time', active: 'Active', processingNow: 'Processing now',
        queue: 'Queue', waiting: 'Waiting', cacheHit: 'Cache Hit', hits: 'hits', providers: 'Providers', healthy: 'Healthy',
        // Charts
        latencyDistribution: 'Request Latency Distribution', last100: 'Last 100 requests',
        statusDistribution: 'Request Status Distribution', currentSession: 'Current session',
        // Provider status
        providerStatus: 'Provider Status', latency: 'Latency', success: 'Success', enabled: 'Enabled', yes: 'Yes', no: 'No',
        // Activity log
        activityLog: 'Activity Log', clear: 'Clear', noActivity: 'No activity yet...',
        // Features
        features: 'Features',
        // Requests tab
        recentRequests: 'Recent Requests', allStatus: 'All Status', queued: 'Queued', processing: 'Processing',
        completed: 'Completed', failed: 'Failed', allProviders: 'All Providers', refresh: 'Refresh',
        id: 'ID', provider: 'Provider', agent: 'Agent', status: 'Status', message: 'Message', created: 'Created', actions: 'Actions',
        view: 'View', cancel: 'Cancel', noRequests: 'No requests found',
        // Test tab
        quickTest: 'Quick Test', autoDefault: 'Auto (Default)', parallel: 'Parallel', fastProviders: 'Fast Providers',
        mediumProviders: 'Medium Providers', slowProviders: 'Slow Providers', chineseProviders: 'Chinese Providers',
        codingProviders: 'Coding Providers', allProvidersGroup: 'All Providers @all',
        enterMessage: 'Enter your test message...', stream: 'Stream', bypassCache: 'Bypass Cache',
        sendTest: 'Send Test Request', sending: 'Sending...', result: 'Result', requestId: 'Request ID',
        cached: 'Cached', response: 'Response', sendToSee: 'Send a test request to see results',
        // Compare tab
        providerComparison: 'Provider Comparison', performanceMetrics: 'Performance Metrics',
        avgLatency: 'Avg Latency', successRate: 'Success Rate', score: 'Score',
        requestTimeline: 'Request Timeline', last1h: 'Last 1 Hour', last6h: 'Last 6 Hours', last24h: 'Last 24 Hours',
        quickBenchmark: 'Quick Benchmark', enterBenchmark: 'Enter test message for benchmark...',
        runBenchmark: 'Run Benchmark', running: 'Running...',
        // API Keys tab
        apiKeys: 'API Keys', createKey: '+ Create Key', keyId: 'Key ID', name: 'Name',
        createdAt: 'Created', lastUsed: 'Last Used', rateLimit: 'Rate Limit', never: 'Never', default: 'Default',
        activeStatus: 'Active', disabled: 'Disabled', disable: 'Disable', enable: 'Enable', delete: 'Delete',
        newKeyCreated: 'New API Key Created', saveKeyNow: "Save this key now - it won't be shown again!",
        dismiss: 'Dismiss', createApiKey: 'Create API Key', rateLimitRpm: 'Rate Limit (RPM, optional)',
        leaveEmpty: 'Leave empty for default', cancelBtn: 'Cancel', create: 'Create',
        // Config tab
        authentication: 'Authentication', rateLimiting: 'Rate Limiting', retryFallback: 'Retry & Fallback',
        cacheStats: 'Cache Statistics', prometheusMetrics: 'Prometheus Metrics', apiDocs: 'API Documentation',
        cliReference: 'CLI Reference', asyncWorkflow: 'Async Workflow', blockingCall: 'Blocking Call',
        checkStatus: 'Check Status', getResponse: 'Get Response', listPending: 'List Pending',
        getLatest: 'Get Latest', pingProvider: 'Ping Provider',
        requestsPerMin: 'Requests/min', burstSize: 'Burst Size', retryEnabled: 'Retry Enabled',
        maxRetries: 'Max Retries', fallbackEnabled: 'Fallback Enabled', misses: 'Misses',
        totalEntries: 'Total Entries', tokensSaved: 'Tokens Saved', viewRawMetrics: 'View Raw Metrics',
        endpoint: 'Endpoint', openApiSwagger: 'OpenAPI / Swagger UI', interactiveApi: 'Interactive API documentation',
        headerName: 'Header', allowLocalhost: 'Allow Localhost',
        // Request detail modal
        requestDetails: 'Request Details', thinking: 'Thinking Chain', rawOutput: 'Raw Output',
        // Shortcuts modal
        keyboardShortcuts: 'Keyboard Shortcuts', closeModal: 'Close Modal',
        // Misc
        exportSuccess: 'Data exported successfully', refreshed: 'Refreshed', benchmarkComplete: 'Benchmark completed',
        // Phase 8A additions
        copy: 'Copy', copyToClipboard: 'Copy to clipboard', copiedToClipboard: 'Copied to clipboard!',
        searchRequests: 'Search requests...', showing: 'Showing', of: 'of', perPage: 'per page',
        confirm: 'Confirm', deleteKey: 'Delete API Key', confirmDeleteKey: 'Are you sure you want to delete this API key? This action cannot be undone.',
        cancelRequest: 'Cancel Request', confirmCancelRequest: 'Are you sure you want to cancel this request?',
        retry: 'Retry', requestRetried: 'Request retried successfully',
        // Phase 8B additions
        selectTemplate: 'Select template...', saveTemplate: 'Save Template', templateName: 'Template Name',
        enterTemplateName: 'Enter template name', templatePreview: 'Preview', save: 'Save',
        templateSaved: 'Template saved', templateLoaded: 'Template loaded', templateDeleted: 'Template deleted',
        manageTemplates: 'Manage Templates', noTemplates: 'No templates saved',
        // Error messages
        failedToCopy: 'Failed to copy to clipboard', failedToRetry: 'Failed to retry request',
        failedToFetch: 'Failed to fetch requests', failedToDelete: 'Failed to delete API key',
        keyDeleted: 'API key deleted',
        // Phase 8C additions
        cacheManagement: 'Cache Management', clearCache: 'Clear Cache', clearAll: 'Clear All',
        cleanup: 'Cleanup', cleanupExpired: 'Cleanup expired entries',
        confirmClearCache: 'Are you sure you want to clear all cache entries? This cannot be undone.',
        cacheCleared: 'Cache cleared successfully', failedToClearCache: 'Failed to clear cache',
        cleanupComplete: 'Cleanup complete', entriesRemoved: 'entries removed',
        failedToCleanupCache: 'Failed to cleanup cache', hitRate: 'Hit Rate',
        memorySaved: 'Memory Used', clickToDisable: 'Click to disable', clickToEnable: 'Click to enable',
        failedToToggleProvider: 'Failed to toggle provider',
        // Phase 8D additions
        tokenUsage: 'Token Usage', tokensByProvider: 'Tokens by Provider',
        inputTokens: 'Input', outputTokens: 'Output', total: 'Total', cost: 'Cost', lastCheck: 'Last check',
        estimatedCost: 'Est. Cost', toggleTheme: 'Toggle theme',
        alertSettings: 'Alert Settings', highLatencyAlert: 'High Latency Alert',
        lowSuccessRateAlert: 'Low Success Rate Alert', queueDepthAlert: 'Queue Depth Alert',
        threshold: 'Threshold', items: 'items', saveSettings: 'Save Settings',
        alertsSaved: 'Alert settings saved', highLatencyDetected: 'High latency detected',
        lowSuccessRateDetected: 'Low success rate detected', highQueueDepthDetected: 'High queue depth detected',
        // Warmup additions
        warmup: 'Warmup', warmupAll: 'Warmup All CLIs', warmupAllCLIs: 'Warmup All CLIs',
        warmupDescription: 'Send a warmup request to all selected AI providers to initialize their connections and reduce first-request latency.',
        warmupMessage: 'Warmup Message', enterWarmupMessage: 'Enter warmup message...',
        selectProviders: 'Select Providers', selectAll: 'Select All', deselectAll: 'Deselect All',
        providersSelected: 'providers selected', startWarmup: 'Start Warmup', warming: 'Warming...',
        warmupResults: 'Results', warmupComplete: 'Warmup complete', warmupFailed: 'Warmup failed',
        close: 'Close',
        // Monitor tab
        liveMonitor: 'Live Monitor', autoScroll: 'Auto Scroll', gridView: 'Grid', focusView: 'Focus',
        waitingForOutput: 'Waiting for output...', sendRequestToMonitor: 'Send a request to see live output',
        noActiveStreams: 'No active streams', streamingOutput: 'Streaming Output',
        // Discussions tab
        discussions: 'Discussions', multiAiDiscussion: 'Multi-AI Discussion',
        discussionTopic: 'Topic', discussionStatus: 'Status', discussionRound: 'Round',
        discussionProviders: 'Providers', discussionCreated: 'Created',
        noDiscussions: 'No discussions found', viewDiscussion: 'View',
        discussionInProgress: 'In Progress', discussionCompleted: 'Completed',
        discussionFailed: 'Failed', roundProposal: 'Proposal', roundReview: 'Review',
        roundRevision: 'Revision', roundSummary: 'Summary',
        discussionMessages: 'Messages', discussionSummary: 'Summary',
        newDiscussion: 'New Discussion', startDiscussion: 'Start Discussion',
        enterTopic: 'Enter discussion topic...', selectDiscussionProviders: 'Select Providers',
        discussionRounds: 'Rounds', quickMode: 'Quick Mode (2 rounds)',
        starting: 'Starting...', refreshDiscussions: 'Refresh',
        // Memory tab
        memory: 'Memory', memoryStats: 'Memory Statistics', memorySessions: 'Sessions',
        searchMemory: 'Search memory...', noMemorySessions: 'No sessions found',
        // Skills tab
        skills: 'Skills', skillsStats: 'Skills Statistics', searchSkills: 'Search for skill...',
        noSkillsFound: 'No skills found',
    },
    zh: {
        // Header
        connected: '已连接', disconnected: '已断开', uptime: '运行时间', switchLang: '切换语言',
        // Tabs
        dashboard: '仪表板', requests: '请求', test: '测试', compare: '对比', keys: 'API 密钥', config: '配置',
        // Dashboard cards
        totalRequests: '总请求数', allTime: '累计', active: '活跃', processingNow: '正在处理',
        queue: '队列', waiting: '等待中', cacheHit: '缓存命中', hits: '次', providers: '提供者', healthy: '健康',
        // Charts
        latencyDistribution: '请求延迟分布', last100: '最近 100 个请求',
        statusDistribution: '请求状态分布', currentSession: '当前会话',
        // Provider status
        providerStatus: '提供者状态', latency: '延迟', success: '成功率', enabled: '启用', yes: '是', no: '否',
        // Activity log
        activityLog: '活动日志', clear: '清除', noActivity: '暂无活动...',
        // Features
        features: '功能',
        // Requests tab
        recentRequests: '最近请求', allStatus: '全部状态', queued: '排队中', processing: '处理中',
        completed: '已完成', failed: '失败', allProviders: '全部提供者', refresh: '刷新',
        id: 'ID', provider: '提供者', agent: 'Agent', status: '状态', message: '消息', created: '创建时间', actions: '操作',
        view: '查看', cancel: '取消', noRequests: '未找到请求',
        // Test tab
        quickTest: '快速测试', autoDefault: '自动（默认）', parallel: '并行', fastProviders: '快速提供者',
        mediumProviders: '中速提供者', slowProviders: '慢速提供者', chineseProviders: '中文提供者',
        codingProviders: '编程提供者', allProvidersGroup: '全部提供者 @all',
        enterMessage: '输入测试消息...', stream: '流式', bypassCache: '绕过缓存',
        sendTest: '发送测试请求', sending: '发送中...', result: '结果', requestId: '请求 ID',
        cached: '已缓存', response: '响应', sendToSee: '发送测试请求以查看结果',
        // Compare tab
        providerComparison: '提供者对比', performanceMetrics: '性能指标',
        avgLatency: '平均延迟', successRate: '成功率', score: '评分',
        requestTimeline: '请求时间线', last1h: '最近 1 小时', last6h: '最近 6 小时', last24h: '最近 24 小时',
        quickBenchmark: '快速基准测试', enterBenchmark: '输入基准测试消息...',
        runBenchmark: '运行基准测试', running: '运行中...',
        // API Keys tab
        apiKeys: 'API 密钥', createKey: '+ 创建密钥', keyId: '密钥 ID', name: '名称',
        createdAt: '创建时间', lastUsed: '最后使用', rateLimit: '速率限制', never: '从未', default: '默认',
        activeStatus: '活跃', disabled: '已禁用', disable: '禁用', enable: '启用', delete: '删除',
        newKeyCreated: '新 API 密钥已创建', saveKeyNow: '请立即保存此密钥 - 之后将不再显示！',
        dismiss: '关闭', createApiKey: '创建 API 密钥', rateLimitRpm: '速率限制（每分钟，可选）',
        leaveEmpty: '留空使用默认值', cancelBtn: '取消', create: '创建',
        // Config tab
        authentication: '认证', rateLimiting: '速率限制', retryFallback: '重试与降级',
        cacheStats: '缓存统计', prometheusMetrics: 'Prometheus 指标', apiDocs: 'API 文档',
        cliReference: 'CLI 命令参考', asyncWorkflow: '异步工作流', blockingCall: '阻塞调用',
        checkStatus: '检查状态', getResponse: '获取响应', listPending: '列出待处理',
        getLatest: '获取最新', pingProvider: '检查连接',
        requestsPerMin: '每分钟请求数', burstSize: '突发大小', retryEnabled: '重试启用',
        maxRetries: '最大重试次数', fallbackEnabled: '降级启用', misses: '未命中',
        totalEntries: '总条目', tokensSaved: '节省 Token', viewRawMetrics: '查看原始指标',
        endpoint: '端点', openApiSwagger: 'OpenAPI / Swagger UI', interactiveApi: '交互式 API 文档',
        headerName: '请求头', allowLocalhost: '允许本地访问',
        // Request detail modal
        requestDetails: '请求详情', thinking: '思考链', rawOutput: '原始输出',
        // Shortcuts modal
        keyboardShortcuts: '键盘快捷键', closeModal: '关闭弹窗',
        // Misc
        exportSuccess: '数据导出成功', refreshed: '已刷新', benchmarkComplete: '基准测试完成',
        // Phase 8A additions
        copy: '复制', copyToClipboard: '复制到剪贴板', copiedToClipboard: '已复制到剪贴板！',
        searchRequests: '搜索请求...', showing: '显示', of: '共', perPage: '每页',
        confirm: '确认', deleteKey: '删除 API 密钥', confirmDeleteKey: '确定要删除此 API 密钥吗？此操作无法撤销。',
        cancelRequest: '取消请求', confirmCancelRequest: '确定要取消此请求吗？',
        retry: '重试', requestRetried: '请求重试成功',
        // Phase 8B additions
        selectTemplate: '选择模板...', saveTemplate: '保存模板', templateName: '模板名称',
        enterTemplateName: '输入模板名称', templatePreview: '预览', save: '保存',
        templateSaved: '模板已保存', templateLoaded: '模板已加载', templateDeleted: '模板已删除',
        manageTemplates: '管理模板', noTemplates: '暂无保存的模板',
        // Error messages
        failedToCopy: '复制到剪贴板失败', failedToRetry: '重试请求失败',
        failedToFetch: '获取请求失败', failedToDelete: '删除 API 密钥失败',
        keyDeleted: 'API 密钥已删除',
        // Phase 8C additions
        cacheManagement: '缓存管理', clearCache: '清除缓存', clearAll: '清除全部',
        cleanup: '清理', cleanupExpired: '清理过期条目',
        confirmClearCache: '确定要清除所有缓存条目吗？此操作无法撤销。',
        cacheCleared: '缓存已清除', failedToClearCache: '清除缓存失败',
        cleanupComplete: '清理完成', entriesRemoved: '条目已移除',
        failedToCleanupCache: '清理缓存失败', hitRate: '命中率',
        memorySaved: '内存占用', clickToDisable: '点击禁用', clickToEnable: '点击启用',
        failedToToggleProvider: '切换提供者状态失败',
        // Phase 8D additions
        tokenUsage: 'Token 用量', tokensByProvider: '各提供者 Token 统计',
        inputTokens: '输入', outputTokens: '输出', total: '合计', cost: '成本', lastCheck: '上次检查',
        estimatedCost: '预估成本', toggleTheme: '切换主题',
        alertSettings: '告警设置', highLatencyAlert: '高延迟告警',
        lowSuccessRateAlert: '低成功率告警', queueDepthAlert: '队列深度告警',
        threshold: '阈值', items: '项', saveSettings: '保存设置',
        alertsSaved: '告警设置已保存', highLatencyDetected: '检测到高延迟',
        lowSuccessRateDetected: '检测到低成功率', highQueueDepthDetected: '检测到队列深度过高',
        // Warmup additions
        warmup: '预热', warmupAll: '预热所有 CLI', warmupAllCLIs: '预热所有 CLI',
        warmupDescription: '向所有选中的 AI 提供者发送预热请求，初始化连接并减少首次请求延迟。',
        warmupMessage: '预热消息', enterWarmupMessage: '输入预热消息...',
        selectProviders: '选择提供者', selectAll: '全选', deselectAll: '取消全选',
        providersSelected: '个提供者已选中', startWarmup: '开始预热', warming: '预热中...',
        warmupResults: '结果', warmupComplete: '预热完成', warmupFailed: '预热失败',
        close: '关闭',
        // Monitor tab
        liveMonitor: '实时监控', autoScroll: '自动滚动', gridView: '网格', focusView: '聚焦',
        waitingForOutput: '等待输出...', sendRequestToMonitor: '发送请求以查看实时输出',
        noActiveStreams: '无活跃流', streamingOutput: '流式输出',
        // Discussions tab
        discussions: '讨论', multiAiDiscussion: '多 AI 讨论',
        discussionTopic: '主题', discussionStatus: '状态', discussionRound: '轮次',
        discussionProviders: '参与者', discussionCreated: '创建时间',
        noDiscussions: '未找到讨论', viewDiscussion: '查看',
        discussionInProgress: '进行中', discussionCompleted: '已完成',
        discussionFailed: '失败', roundProposal: '提案', roundReview: '互评',
        roundRevision: '修订', roundSummary: '汇总',
        discussionMessages: '消息', discussionSummary: '总结',
        newDiscussion: '新建讨论', startDiscussion: '开始讨论',
        enterTopic: '输入讨论主题...', selectDiscussionProviders: '选择参与者',
        discussionRounds: '讨论轮数', quickMode: '快速模式（2轮）',
        starting: '启动中...', refreshDiscussions: '刷新',
        // Memory tab
        memory: '记忆', memoryStats: '记忆统计', memorySessions: '会话',
        searchMemory: '搜索记忆...', noMemorySessions: '未找到会话',
        // Skills tab
        skills: '技能', skillsStats: '技能统计', searchSkills: '搜索技能...',
        noSkillsFound: '未找到技能',
    }
};

/**
 * Create i18n helper function
 * @param {string} langCode - Current language code
 * @returns {function} Translation function
 */
function createTranslator(langCode) {
    return (key) => i18n[langCode]?.[key] || i18n['en'][key] || key;
}

/**
 * Get all supported languages
 * @returns {string[]} Array of language codes
 */
function getSupportedLanguages() {
    return Object.keys(i18n);
}

// Export for ES modules (if used)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { i18n, createTranslator, getSupportedLanguages };
}
