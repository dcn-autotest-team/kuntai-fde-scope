<template>
  <section id="stats" class="section">
    <div class="shell">
      <div class="section-header">
        <h2>Agent 进化看板</h2>
        <p>通过持续收集人工专家判定确认与纠正反馈，沉淀微领域判定经验，驱动 Agent 建议采纳率提升。</p>
      </div>

      <div class="stats-cards">
        <div class="card stat-box">
          <span class="stat-num">{{ stats.totalCases || 0 }}</span>
          <span class="stat-label">历史判定案例数</span>
        </div>
        <div class="card stat-box">
          <span class="stat-num">{{ stats.confirmedCases || 0 }}</span>
          <span class="stat-label">人工确认案例</span>
        </div>
        <div class="card stat-box">
          <span class="stat-num">{{ stats.lessonCount || 0 }}</span>
          <span class="stat-label">沉淀判定经验条目</span>
        </div>
        <div class="card stat-box highlight">
          <span class="stat-num">{{ stats.acceptanceRate !== null ? stats.acceptanceRate + '%' : '100%' }}</span>
          <span class="stat-label">AI 建议采纳率</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import client from '../api/client'

const stats = ref({
  totalCases: 0,
  confirmedCases: 0,
  lessonCount: 0,
  acceptanceRate: null
})

const fetchStats = async () => {
  try {
    const res = await client.get('/agent/stats')
    if (res.data) {
      stats.value = res.data
    }
  } catch (err) {
    console.error('Fetch stats failed', err)
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<style scoped>
.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 24px;
}

.stat-box {
  text-align: center;
  padding: 32px 20px;
}

.stat-box.highlight {
  background: linear-gradient(135deg, #0b132b 0%, #1c2541 100%);
  color: #fff;
}

.stat-box.highlight .stat-num {
  color: var(--color-accent);
}

.stat-box.highlight .stat-label {
  color: #cbd5e1;
}

.stat-num {
  display: block;
  font-size: 38px;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--color-text-sub);
}
</style>
