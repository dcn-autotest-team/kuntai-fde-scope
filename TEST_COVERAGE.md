# 单元测试覆盖度报告

报告日期：2026-08-07

## 结论

前后端全量业务源码覆盖率均已超过 90%，并已配置 90% 覆盖率门槛，后续覆盖率回退会导致测试命令失败。

| 范围 | 测试数 | 语句/行覆盖率 | 分支覆盖率 | 函数覆盖率 | 综合覆盖率 |
|---|---:|---:|---:|---:|---:|
| 后端 `backend/app` | 58 | 99.0% | 93.1% | — | 97.9% |
| 前端 `frontend/src` | 28 | 99.2% | 90.74% | 92.72% | 99.2%（行） |

测试结果：后端 58 项、前端 28 项全部通过，前端生产构建通过。

## 统计口径

覆盖率统计包含全部业务源码，不通过排除低覆盖业务文件提升数字。

### 后端

- 工具：`pytest`、`pytest-cov`、`coverage.py`
- 范围：`backend/app/**/*.py`，包含 namespace package 中未主动导入的模块
- 指标：语句覆盖率、分支覆盖率与 coverage.py 综合覆盖率
- 失败门槛：综合覆盖率低于 90%
- 配置：`backend/.coveragerc`

```bash
cd backend
pytest tests -q --cov=app --cov-branch --cov-report=term-missing --cov-report=html:htmlcov
```

HTML 报告：`backend/htmlcov/index.html`

### 前端

- 工具：`Vitest`、`Vue Test Utils`、V8 Coverage
- 范围：`frontend/src/**/*.{js,vue}`，仅排除测试文件
- 指标：语句、分支、函数和行覆盖率
- 失败门槛：四项指标分别不得低于 90%
- 配置：`frontend/vite.config.js`

```bash
cd frontend
npm run test:coverage
```

HTML 报告：`frontend/coverage/index.html`

## 后端覆盖情况

| 模块 | 综合覆盖率 | 已覆盖行为 |
|---|---:|---|
| `agent/core.py` | 100.0% | 输入校验、记忆检索、规划、工具循环、短路、兜底计算、反思与持久化 |
| `agent/llm.py` | 100.0% | 配置、普通/流式请求、状态错误、数据解析与回退 |
| `agent/retrieve.py` | 100.0% | 分词、相似度、过滤、排序、空数据与 `top_k` |
| `agent/nanobot.py` | 100.0% | 工具缺失、正常执行与异常事件 |
| `agent/planner.py` | 100.0% | 自定义规划与默认回退 |
| `agent/tools/*` | 91.8%–100% | 校验、维度分析、红线、结论、服务包与反思 |
| `routers/admin_router.py` | 96.8% | 登录、Token 生命周期、经验库初始化与 CRUD |
| `routers/agent_router.py` | 94.0% | SSE 成功/失败、反馈纠正、经验沉淀与统计 |
| `routers/chat_router.py` | 93.8% | 联网搜索、流式聊天及错误响应 |
| `routers/config_router.py` | 100.0% | 默认配置、创建与更新 |
| `routers/page_router.py` | 96.4% | 参数校验、HTML 提取、普通输出与异常 |
| 数据库、配置、主入口及 Schema | 94.1%–100% | 初始化、Session、模型和应用入口 |

后端仍有少量未覆盖分支，主要是断连检测、部分无效决策组合和日志型容错路径；均不影响总体 90% 门槛。

## 前端覆盖情况

| 模块 | 行覆盖率 | 分支覆盖率 | 函数覆盖率 | 已覆盖行为 |
|---|---:|---:|---:|---|
| `App.vue` | 100% | 100% | 100% | 组件事件联动、结果同步和弹窗状态 |
| `main.js` | 100% | 100% | 100% | 应用创建与挂载 |
| `api/client.js` | 100% | 100% | 100% | Token 注入、匿名请求与 401 清理 |
| `AdminModal.vue` | 97.76% | 86.25% | 80.95% | 登录、配置、经验 CRUD、401 与常见错误 |
| `AiAnalyzer.vue` | 98.85% | 89.79% | 100% | 文档上传、完整 SSE 生命周期、无效需求与网络错误 |
| `DecisionMatrix.vue` | 100% | 95% | 100% | can/maybe/no、红线、AI 回填与反馈提交 |
| `NanobotChat.vue` | 99.35% | 91.04% | 100% | 消息、搜索来源、流式解析、Markdown 与错误 |
| `PageGeneratorModal.vue` | 100% | 88.23% | 100% | 生成、空响应、重试、复制和下载 |
| 展示组件与统计看板 | 100% | 100% | 100% | 渲染、数量、异步成功与失败状态 |

个别组件的单文件分支或函数覆盖率低于 90%，但前端全项目四项指标均超过门槛。低于 90% 的单文件分支主要是重复的错误消息回退和模板事件变体。

## 测试边界

高覆盖率不等于所有系统风险均已消除。当前测试大量使用 Mock/Fake 隔离外部依赖，因此仍建议在发布流程中保留：

1. 接入真实测试数据库的 API 集成测试。
2. 对测试环境 LLM 服务的契约测试。
3. 浏览器端完整 SSE 与下载流程的端到端测试。
4. MySQL、反向代理和长连接部署环境的冒烟测试。

覆盖率门槛用于防止代码路径缺少回归保护，不能替代上述集成与端到端验证。

