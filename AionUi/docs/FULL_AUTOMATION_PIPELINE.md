# HiveMind 全自动测试与迭代流程

本文档定义 HiveMind 的“前端 → 后端 → 打包 → 迭代”自动化闭环。

## 1. 目标

- 在一次命令中覆盖 TypeScript、Lint、单测、契约测试、集成测试、打包。
- 生成可追踪日志与总结报告，作为迭代输入。
- 支持严格模式（任一步失败即失败）与宽松模式（全量执行后给出失败矩阵）。

## 2. 本地一键命令

```bash
# 宽松模式：跑完整链路并输出报告
npm run qa:auto

# 严格模式：任何失败即非 0 退出
npm run qa:auto:strict
```

## 3. 脚本能力

脚本位置：`scripts/full-auto-pipeline.sh`

- 默认阶段：
  1. `npx tsc --noEmit`
  2. `npm run lint`
  3. `npm test -- --runInBand`
  4. `npm run test:contract -- --runInBand`
  5. `npm run test:integration -- --runInBand`
  6. `npm run package -- --arch=arm64`（自动清除代理变量影响）
- 日志输出：`.tmp/qa-logs/<timestamp>/`
- 汇总输出：
  - `summary.txt`
  - `summary.md`

可选参数：

```bash
bash scripts/full-auto-pipeline.sh --strict
bash scripts/full-auto-pipeline.sh --skip-package
bash scripts/full-auto-pipeline.sh --iterations 2
bash scripts/full-auto-pipeline.sh --install-app
```

## 4. 失败到迭代的闭环

1. 执行 `qa:auto` 获取失败矩阵。
2. 按失败阶段修复（优先级：编译 > 测试 > 打包）。
3. 重新执行 `qa:auto:strict` 验证是否收敛。
4. 成功后更新 app 包并进入下一轮 UI/功能迭代。

## 5. 与线上最佳实践的对应关系

- Node 项目在 CI 中构建与测试：
  - https://docs.github.com/en/actions/use-cases-and-examples/building-and-testing/building-and-testing-nodejs
- Node 依赖缓存（加速迭代反馈）：
  - https://github.com/actions/setup-node#caching-global-packages-data
- Playwright CI 指南（用于 UI 自动回归）：
  - https://playwright.dev/docs/ci-intro
  - https://playwright.dev/docs/next/test-configuration
- Electron 自动化测试指南（桌面端验证）：
  - https://www.electronjs.org/docs/latest/tutorial/automated-testing
- Jest 官方文档（单测体系）：
  - https://jestjs.io/docs/getting-started

## 6. 下一步建议

- 接入截图回归（Playwright snapshot）并与 UI 评分门槛绑定。
- 将 `qa:auto:strict` 接入 GitHub Actions 的 PR 必过项。
- 对 ESLint 历史债务引入“基线逐步收敛”策略，避免一次性清理导致迭代停滞。

