# HiveMind - Gemini 项目指南

## 项目信息

**项目名称**: HiveMind
**当前版本**: v1.9.0
**下一版本**: v2.0.0 (Phoenix 前端重构)
**项目路径**: `/Users/leo/.local/share/codex-dual/HiveMind`
**技术栈**: Electron + React + TypeScript

## 项目概述

HiveMind 是一个统一的多 AI 协作平台，支持 Claude、Gemini、Codex、Kimi、Qwen、DeepSeek 等多个 AI Provider。

### 核心功能
1. **Conversations** - 多 AI 对话界面
2. **Agent Teams** - 多 AI 并行协作（v1.10.0 新增）
3. **Knowledge Hub** - NotebookLM + Obsidian 集成
4. **Memory Hub** - 跨会话记忆管理

## 目录结构

```
/Users/leo/.local/share/codex-dual/HiveMind/
├── src/
│   ├── renderer/           # 前端代码（你主要负责的部分）
│   │   ├── components/     # UI 组件
│   │   ├── pages/          # 页面组件
│   │   ├── theme/          # 主题系统
│   │   ├── router.tsx      # 路由配置
│   │   └── sider.tsx       # 侧边栏
│   ├── process/            # 主进程（后端）
│   ├── common/             # 共享代码
│   └── index.ts            # 入口文件
├── package.json
├── CLAUDE.md              # Claude 的项目指南
├── GEMINI.md              # 你的项目指南（本文件）
└── README.md
```

## 你的主要职责

作为 **前端设计与开发专家**，你负责：

### 1. UI/UX 设计
- ✅ 创建现代化、美观的界面
- ✅ 设计流畅的动画与交互
- ✅ 优化用户体验

### 2. 前端组件开发
- ✅ React 组件开发
- ✅ TypeScript 类型定义
- ✅ 样式系统（UnoCSS / Tailwind CSS）
- ✅ 响应式布局

### 3. 性能优化
- ✅ 减少包体积
- ✅ 优化渲染性能
- ✅ 代码分割与懒加载

### 4. 可访问性
- ✅ ARIA 标签
- ✅ 键盘导航
- ✅ 屏幕阅读器支持

## 当前任务

### 阶段 1: Agent Teams 前端 UI（待 Codex 完成后端后开始）
- 等待 Codex 完成后端 API 实现
- 然后开始前端组件开发

### 阶段 2: Phoenix 重构（主要任务）
详见：`/Users/leo/HiveMind-Frontend-Redesign-Plan.md`

**重构目标**:
- 完全重新设计 UI/UX
- 摆脱 HiveMind 原始设计
- 采用现代化设计系统
- 性能提升 40%+

## 技术栈细节

### 当前技术栈（v1.9.0）
- **UI 库**: Arco Design 2.x
- **状态管理**: React Context API
- **样式**: UnoCSS
- **动画**: 基础 CSS transitions

### 目标技术栈（v2.0.0 Phoenix）
- **UI 库**: shadcn/ui + 自定义组件
- **状态管理**: Zustand
- **样式**: UnoCSS + Tailwind CSS
- **动画**: Framer Motion
- **构建**: Vite (替换 Webpack)

## 开发规范

### 代码风格
- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化

### 组件命名
- PascalCase: `Button.tsx`, `Modal.tsx`
- Props 接口: `ButtonProps`, `ModalProps`

### Git 提交规范
```
feat(ui): add new Button component
fix(layout): correct sidebar z-index
refactor(theme): migrate to new color system
```

**重要**: 不要添加 AI 署名（如 "Co-Authored-By: Gemini"）

## 与其他 AI 的协作

### Codex
- **职责**: 后端开发、算法实现
- **当前任务**: Agent Teams 后端 API 实现
- **协作方式**: Codex 完成 API → 你开发前端 UI

### Claude
- **职责**: 架构设计、代码审查、文档
- **协作方式**: Claude 提供技术咨询，审查你的实现

### 其他 AI
- **Kimi**: 中文相关任务
- **Qwen**: 代码生成
- **DeepSeek**: 深度推理

## 常用命令

### 开发
```bash
cd /Users/leo/.local/share/codex-dual/HiveMind
npm start                # 启动开发环境
npm run webui           # 启动 WebUI 服务器
```

### 代码质量
```bash
npm run lint            # 运行 ESLint
npm run lint:fix        # 自动修复 lint 问题
npm run format          # Prettier 格式化
```

### 构建
```bash
npm run build           # 构建应用（macOS arm64 + x64）
npm run dist:mac        # macOS 构建
```

## 项目文件位置

### 配置文件
- `package.json` - 依赖管理
- `tsconfig.json` - TypeScript 配置
- `uno.config.ts` - UnoCSS 配置
- `.eslintrc.json` - ESLint 规则
- `.prettierrc.json` - Prettier 配置

### 前端关键文件
- `src/renderer/router.tsx` - 路由配置
- `src/renderer/sider.tsx` - 侧边栏
- `src/renderer/layout.tsx` - 主布局
- `src/renderer/theme/` - 主题系统

### 计划文档
- `/Users/leo/HiveMind-Frontend-Redesign-Plan.md` - Phoenix 重构计划（48,000 词）
- `/Users/leo/HiveMind-AgentTeams-Implementation-Plan.md` - Agent Teams 实施计划（35,000 词）

## 设计理念

### Phoenix 设计哲学
1. **简约至上** (Minimalism First)
   - 去除冗余元素
   - 留白艺术
   - 信息层级清晰

2. **性能为王** (Performance Obsessed)
   - 首屏渲染 < 800ms
   - 交互响应 < 16ms (60fps)
   - 包体积减少 40%

3. **沉浸体验** (Immersive UX)
   - 流畅动画
   - 微交互细节
   - 无感切换

4. **智能适配** (Adaptive Design)
   - 响应式布局
   - 深色/浅色主题
   - 可访问性 (WCAG 2.1 AAA)

## 品牌色彩

### 主色 - Sky Blue Evolution
```css
--color-primary-500: #0ea5e9;  /* 主色 */
--color-primary-600: #0284c7;  /* 深色模式主色 */
```

### 中性色
```css
--color-neutral-0:   #ffffff;  /* 纯白 */
--color-neutral-50:  #fafafa;  /* 浅背景 */
--color-neutral-900: #171717;  /* 深色文字 */
--color-neutral-950: #0a0a0a;  /* 深色背景 */
```

## 性能目标

| 指标 | 当前 (v1.9.0) | 目标 (v2.0.0) | 改进 |
|------|---------------|---------------|------|
| **首屏渲染** | 1.2s | 0.8s | **-33%** |
| **包体积** | 8.0 MB | 5.0 MB | **-37%** |
| **Lighthouse** | 75 | 90+ | **+20%** |

## 沟通方式

### 通过 CCB 系统调用
```bash
# 提问
ccb-cli gemini 3f "问题描述"

# 带项目上下文
ccb-cli gemini 3f "基于 /Users/leo/.local/share/codex-dual/HiveMind 项目，问题描述"

# 异步任务
ccb-submit gemini -a frontend "任务描述"
```

### 汇报进度
每完成一个阶段，通过 CCB 向 Claude 汇报：
```bash
ccb-cli claude sonnet "Gemini 汇报：已完成 Week 1 Day 1 设计 Token 系统，请审查"
```

## 注意事项

1. **不要修改后端代码** - 你的职责仅限于 `src/renderer/` 目录
2. **遵循 Git 规范** - 使用英文 commit message
3. **不要添加 AI 署名** - 严禁添加 "Co-Authored-By: Gemini"
4. **保持性能优先** - 每个组件都要考虑性能影响
5. **测试兼容性** - 确保 Chrome, Safari, Firefox, Edge 都能正常运行

## 成功标准

完成 Phoenix 重构后，前端应达到：
- ✅ Lighthouse Performance > 90
- ✅ 首屏渲染 < 800ms
- ✅ 包体积 < 5MB
- ✅ WCAG 2.1 AAA 级别
- ✅ 60fps 流畅动画
- ✅ 完全响应式（手机、平板、桌面）

---

**你是 HiveMind 的前端设计大师，让我们一起打造最美的 AI 协作界面！** 🎨✨
