<template>
  <section id="packages" class="section">
    <div class="shell">
      <div class="section-header">
        <h2>神州鲲泰 FDE 标准服务包</h2>
        <p>小步快跑、阶段性交付与明确移交的标准工程包。</p>
      </div>

      <div class="packages-grid">
        <div v-for="pkg in packages" :key="pkg.title" class="card package-card">
          <div class="pkg-header">
            <h3>{{ pkg.title }}</h3>
            <span class="duration-badge">{{ pkg.duration }}</span>
          </div>
          <p class="pkg-desc">{{ pkg.desc }}</p>
          <ul class="pkg-deliverables">
            <li v-for="item in pkg.deliverables" :key="item">✓ {{ item }}</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
const packages = [
  {
    title: 'AI 场景诊断工作坊',
    duration: '3 - 5 天',
    desc: '梳理业务流程痛点，识别高价值 AI 应用场景，打磨 ROI 假设与 MVP 实施路线图。',
    deliverables: ['《场景诊断清单》', '《ROI 与优先级评估矩阵》', '《MVP 实施路线图》']
  },
  {
    title: 'RAG / 知识库 PoC',
    duration: '1 - 3 周',
    desc: '快速搭建企业内部文档解析与检索问答原型，评估召回率与回答准确率。',
    deliverables: ['知识库检索 Demo 原型', '《文档解析与切片方案》', '《评测用例集与Badcase报告》']
  },
  {
    title: 'Agent 原型搭建与工具接入',
    duration: '2 - 4 周',
    desc: '拆解复杂业务流程为 Agent 步骤，对接 MCP/内部 API，提供半自动人机协同闭环。',
    deliverables: ['Agent 可运行原型代码', '《Tool Calling 接口规范》', '《人工审核与日志追溯方案》']
  },
  {
    title: 'AI 应用评估与测试用例设计',
    duration: '1 周',
    desc: '对既有 AI 应用或候选模型进行量化评估，提供压测、输出稳定性与安全判定报告。',
    deliverables: ['《AI 评测用例与基准数据集》', '《模型输出稳定性评估报告》', '《灰度发布建议》']
  },
  {
    title: '推理部署与国产算力验证',
    duration: '1 - 2 周',
    desc: '在 Linux/Docker 基础上验证 GPU 服务器算力与模型推理性能，输出部署 checklist。',
    deliverables: ['Docker 镜像与部署脚本', '《推理吞吐量与时延测试报告》', '《环境部署 Checklist》']
  }
]
</script>

<style scoped>
.packages-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.package-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: var(--transition);
}

.package-card:hover {
  transform: translateY(-4px);
  border-color: #d1d5db;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.08);
}

.pkg-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.pkg-header h3 {
  font-size: 17px;
  font-weight: 700;
}

.duration-badge {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}

.pkg-desc {
  font-size: 14px;
  color: var(--color-text-sub);
  margin-bottom: 16px;
  line-height: 1.5;
}

.pkg-deliverables {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-main);
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
}
</style>
