# HiveMind - Kimi 项目指南

## 你的职责
前端开发专家，负责：
1. Agent Teams 前端 UI 完善
2. Phoenix 设计系统实施
3. 性能优化
4. 测试覆盖

## 项目路径
/Users/leo/.local/share/codex-dual/HiveMind

## 主要工作目录
- src/renderer/ - 前端代码
- src/renderer/pages/agentTeams/ - Agent Teams 页面（你的重点）
- src/renderer/components/ - 组件库

## 当前任务状态

### Week 1: Agent Teams 前端完善

#### Day 1: 环境准备 + Dashboard 优化 ✅ 已完成
- [x] 安装依赖 (@dnd-kit, recharts, framer-motion, zustand, @tanstack/react-virtual, clsx)
- [x] 创建 KIMI.md 项目配置文件
- [x] 优化 Dashboard.tsx
  - 应用 Phoenix Design Tokens
  - 集成 Framer Motion 动画
  - 添加 7 天任务完成趋势图
  - 优化活跃团队列表显示
  - 修复 TypeScript 类型错误
- [x] 修复所有组件的路径别名问题

#### Day 2: 任务看板拖拽实现 ✅ 已完成
- [x] KanbanColumn.tsx 增强
  - 添加状态颜色指示器
  - 集成 Framer Motion 动画
  - 优化拖拽视觉反馈
- [x] TaskCard.tsx 增强
  - 添加 Provider 颜色标签
  - 添加优先级颜色指示
  - 集成 Framer Motion 动画
  - 优化任务卡片布局

#### Day 3-5: 待进行
- [ ] 团队详情页完善
- [ ] 实时更新优化
- [ ] 性能优化 + 虚拟滚动
- [ ] 测试 + Bug 修复

### P1: Phoenix 设计系统（Week 2）
- [ ] 核心组件库完善
- [ ] Storybook 文档

## 已安装的新依赖
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install @tanstack/react-virtual
npm install recharts d3 @types/d3
npm install framer-motion
npm install zustand
npm install clsx
```

## 新增文件
- `/src/renderer/hooks/useDebounce.ts` - 防抖 Hook
- `/src/renderer/hooks/useRealtimeUpdates.ts` - 实时更新 Hook
- `/src/renderer/hooks/index.ts` - Hooks 导出

## 修改文件
- `/src/renderer/pages/agentTeams/Dashboard.tsx` - 全面优化
- `/src/renderer/pages/agentTeams/components/KanbanColumn.tsx` - 视觉增强
- `/src/renderer/pages/agentTeams/components/TaskCard.tsx` - 视觉增强
- `/src/renderer/pages/agentTeams/TasksKanbanPage.tsx` - 修复路径
- `/src/renderer/pages/agentTeams/TeamDetailPage.tsx` - 修复路径

## 代码规范
- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 中文注释
- 英文 commit message

## Git 提交格式
```
feat(agentTeams): implement kanban drag and drop
fix(dashboard): correct stats calculation
refactor(taskCard): improve component structure
```

## 注意事项
- 组件导入路径使用 `@/renderer/components/` 而不是 `@/components/`
- Framer Motion variants 的 ease 属性需要使用 `as const` 断言
- Tag 组件的 size 属性不支持 "mini"，使用 "small" 替代
