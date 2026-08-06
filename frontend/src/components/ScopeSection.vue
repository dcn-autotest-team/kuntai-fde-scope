<template>
  <section id="scope" class="section">
    <div class="shell">
      <div class="section-header">
        <h2>FDE 团队能力范围与红线说明</h2>
        <p>定位为前线工程小队，做深做透 PoC / 原型 / 测试与应用验证，明确移交边界。</p>
      </div>

      <div class="scope-grid">
        <div class="card scope-card do">
          <div class="scope-header">
            <h3>✅ FDE 核心定位与擅长做（Can Do）</h3>
          </div>
          <ul class="scope-list">
            <li><strong>AI 场景诊断工作坊：</strong>业务流程访谈、场景清单、ROI 假设与 MVP 路线图</li>
            <li><strong>RAG / 知识库 PoC：</strong>文档解析、向量检索、Prompt 调试与 Badcase 评测集</li>
            <li><strong>Agent 原型搭建：</strong>多步骤任务拆解、MCP/API 接入原型与人工审核闭环</li>
            <li><strong>AI 应用效果评估：</strong>测试用例设计、性能压测、模型输出比对与灰度监控</li>
            <li><strong>推理部署验证：</strong>Docker 基础部署、GPU 服务器环境连通性验证与部署 checklist</li>
          </ul>
        </div>

        <div class="card scope-card dont">
          <div class="scope-header">
            <h3>⛔ 6 大明确红线与不能独立承接（Redlines）</h3>
          </div>
          <ul class="scope-list">
            <li><strong>无人审核自动决策：</strong>涉及医疗诊断、无人审核金融放款、风险处置严禁独立闭环</li>
            <li><strong>越权操作生产环境：</strong>未经授权或缺乏安全审批的生产数据库/核心网变动</li>
            <li><strong>生产级总包兜底：</strong>要求包含全套多租户、计费、灾备的高并发大平台总包</li>
            <li><strong>7x24 长期托管 SLA：</strong>要求团队承担上线后 7x24 运维与常态化值班</li>
            <li><strong>核心业务系统重构：</strong>缺乏客户 IT 协同下的核心 ERP/CRM 主干系统独立重构</li>
            <li><strong>千卡基座大模型训练：</strong>前沿大模型底层框架研发或千卡大规模基座训练</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.scope-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
  gap: 32px;
}

.scope-card.do {
  border-top: 4px solid #16a34a;
}

.scope-card.dont {
  border-top: 4px solid #dc2626;
}

.scope-header h3 {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
}

.scope-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.scope-list li {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-sub);
}

.scope-list strong {
  color: var(--color-text-main);
}
</style>
