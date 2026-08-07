# 神州鲲泰 FDE 团队能力边界判定与展示系统 (Vue 3 + FastAPI + Nanobot Agent)

本项目已完成前后端分离架构重构。

- **前端 (Frontend)**: Vue 3 (Composition API) + Vite SPA，集成 SSE 实时 Agent Trace 动画与 6 维判定矩阵。
- **后端 (Backend)**: Python FastAPI RESTful API，嵌入 **Nanobot 微 Agent 引擎**（感知 -> 记忆检索 -> 自主规划 -> 工具链调度 -> 反思沉淀 -> SSE 流输出）。
- **数据库 (Database)**: SQLAlchemy ORM。开发阶段默认使用 SQLite，生产环境配置环境变量即可无缝切换为 MySQL。

---

## 目录结构

```text
kuntai-fde-scope/
├── backend/                  # FastAPI 后端服务
│   ├── app/
│   │   ├── agent/            # Nanobot Agent 引擎
│   │   │   ├── nanobot.py
│   │   │   ├── core.py
│   │   │   ├── planner.py
│   │   │   ├── retrieve.py
│   │   │   ├── schemas.py    # 新增 Pydantic 数据模型
│   │   │   ├── prompts.py    # 新增 Prompt 模板
│   │   │   └── tools/        # 拆分后的工具模块
│   │   │       ├── __init__.py
│   │   │       ├── base.py
│   │   │       ├── validate.py
│   │   │       ├── analyze.py
│   │   │       ├── redlines.py
│   │   │       ├── verdict.py
│   │   │       └── recommend.py
│   │   ├── database/         # SQLAlchemy 模型与 Session (models.py, session.py)
│   │   ├── routers/          # API 路由 (agent, admin, config, page)
│   │   ├── schemas/          # Pydantic 校验模型
│   │   └── main.py           # FastAPI 主入口
│   ├── requirements.txt      # 后端依赖清单
│   └── run.py                # 后端启动入口 (uvicorn)
├── frontend/                 # Vue 3 SPA 前端
│   ├── src/
│   │   ├── components/       # Vue 组件 (AiAnalyzer, DecisionMatrix, AdminModal 等)
│   │   ├── api/              # Axios 拦截器与 API 封装
│   │   └── App.vue
│   ├── package.json
│   └── vite.config.js
└── README.md
```

---

## 快速启动指南

### 方式一：快捷脚本一键启动 (推荐)

在项目根目录下提供了多组一键启动脚本：

- **同时启动前后端**：双击运行 `start_all.bat`
- **独立启动后端**：双击运行 `start_backend.bat` 或在 PowerShell 执行 `.\start_backend.ps1`
- **独立启动前端**：双击运行 `start_frontend.bat` 或在 PowerShell 执行 `.\start_frontend.ps1`

*(注：子目录 `backend/` 与 `frontend/` 下同样包含独立的 `start.bat` 脚本，可直接运行)*

---

### 方式二：手动命令行启动

#### 1. 启动后端 (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python run.py
```
*后端服务将运行在 `http://localhost:8001`，Swagger API 文档地址为 `http://localhost:8001/docs`。*

#### 2. 启动前端 (Vue 3)

```bash
cd frontend
npm install
npm run dev
```
*前端应用将运行在 `http://localhost:3000`，开发环境已自动设置 `/api` 跨域代理指向后端端口。*

---

## 数据库切换指南 (SQLite -> MySQL)

后端使用 **SQLAlchemy ORM** 建模，启动时会自动建表（无需手动执行 SQL）：

- **开发阶段 (默认 SQLite)**:
  环境变量未设置时，使用 `backend/kuntai_fde.db` SQLite 数据库。

- **上线服务器 (切换 MySQL)**:
  设置环境变量 `DATABASE_URL` 即可：
  ```bash
  export DATABASE_URL="mysql+pymysql://root:123456@localhost:3306/kuntai_fde?charset=utf8mb4"
  ```

---

## 运行单元测试

后端测试：

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests -q
```

前端测试：

```bash
cd frontend
npm install
npm test
```

生成完整覆盖率报告：

```bash
# 后端
cd backend
pytest tests -q --cov=app --cov-branch --cov-report=term-missing --cov-report=html:htmlcov

# 前端
cd frontend
npm run test:coverage
```

覆盖率现状、统计口径和补测计划见 [`TEST_COVERAGE.md`](./TEST_COVERAGE.md)。

---

## GitHub Release CI/CD

发布 GitHub Release 时，`.github/workflows/release.yml` 会自动执行：

1. 校验 Release 标签、前端版本和后端版本一致。
2. 运行后端测试并执行 90% 覆盖率门槛。
3. 运行前端测试并执行语句、分支、函数、行四项 90% 覆盖率门槛。
4. 构建前端生产文件。
5. 上传前后端覆盖率报告和前端构建 Artifact。
6. 将前端 ZIP、后端 `tar.gz` 和 `SHA256SUMS.txt` 附加到 GitHub Release。

发布前需同时更新：

- `frontend/package.json` 中的 `version`
- `backend/app/main.py` 中 FastAPI 的 `version`

然后创建以 `v` 开头且版本一致的 Release，例如：

```bash
git tag v3.1.0
git push origin v3.1.0
gh release create v3.1.0 --generate-notes
```

工作流仅在 GitHub Release 正式发布时触发；草稿 Release 不会执行。
