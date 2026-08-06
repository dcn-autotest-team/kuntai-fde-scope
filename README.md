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
│   │   ├── agent/            # Nanobot Agent 引擎 (nanobot.py, core.py, tools.py, planner.py, retrieve.py)
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

### 1. 启动后端 (FastAPI)

```bash
cd backend
pip install -r requirements.txt
python run.py
```
*后端服务将运行在 `http://localhost:8000`，Swagger API 文档地址为 `http://localhost:8000/docs`。*

### 2. 启动前端 (Vue 3)

```bash
cd frontend
npm install
npm run dev
```
*前端应用将运行在 `http://localhost:3000`，开发环境已自动设置 `/api` 跨域代理指向 8000 端口。*

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
