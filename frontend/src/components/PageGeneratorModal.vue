<template>
  <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content page-modal">
      <div class="modal-header">
        <h3>📄 AI 交付项目展示页生成</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div v-if="loading" class="loading-state">
        <div class="spinner-large"></div>
        <p>架构师 Agent 正在基于判定结论生成独立 HTML 展示页...</p>
      </div>

      <div v-else-if="htmlContent" class="generated-state">
        <div class="preview-actions">
          <button class="btn primary" @click="downloadHtml">
            ⬇️ 下载独立 HTML 文件
          </button>
          <button class="btn secondary" @click="copyHtml">
            📋 复制代码
          </button>
        </div>

        <div class="iframe-container">
          <iframe :srcdoc="htmlContent" frameborder="0"></iframe>
        </div>
      </div>

      <div v-else class="error-state">
        <p>生成失败或配置不完整。</p>
        <button class="btn primary" @click="generate">重试生成</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import client from '../api/client'

const props = defineProps({
  show: Boolean,
  resultData: Object
})
defineEmits(['close'])

const loading = ref(false)
const htmlContent = ref('')

const defaultDimensions = [
  {
    id: 'value',
    title: '需求是否属于 AI 应用落地场景？',
    options: [
      { label: '明确属于 AI 应用落地', score: 2, redflag: false },
      { label: '需要进一步诊断', score: 0, redflag: false },
      { label: '偏纯咨询或纯外包', score: -4, redflag: true }
    ]
  },
  {
    id: 'solution_type',
    title: '交付形态是否适合 PoC / MVP / 试点？',
    options: [
      { label: '适合 PoC/MVP/试点', score: 2, redflag: false },
      { label: '范围需要收敛', score: 0, redflag: false },
      { label: '要求生产级总包', score: -5, redflag: true }
    ]
  },
  {
    id: 'tech_scope',
    title: '技术内容是否落在 RAG / Agent / 测试评估 / 部署验证范围内？',
    options: [
      { label: '高度匹配', score: 2, redflag: false },
      { label: '部分匹配，需外部支持', score: 0, redflag: false },
      { label: '偏底层模型研发或核心系统改造', score: -5, redflag: true }
    ]
  },
  {
    id: 'environment',
    title: '客户环境和数据条件是否可协同、可验证？',
    options: [
      { label: '已授权且可协同', score: 2, redflag: false },
      { label: '审批或环境待确认', score: 0, redflag: false },
      { label: '要求越权操作生产环境', score: -5, redflag: true }
    ]
  },
  {
    id: 'risk',
    title: '是否涉及无人审核的高风险自动决策？',
    options: [
      { label: '有人审核，可追踪', score: 2, redflag: false },
      { label: '风险需进一步评估', score: 0, redflag: false },
      { label: '要求无人审核自动决策', score: -5, redflag: true }
    ]
  },
  {
    id: 'operation',
    title: '上线后责任是否清晰，不要求 FDE 长期托管？',
    options: [
      { label: '可移交客户或运维团队', score: 2, redflag: false },
      { label: '需要短期陪跑', score: 0, redflag: false },
      { label: '要求 7x24 SLA 或长期托管', score: -5, redflag: true }
    ]
  }
]

const generate = async () => {
  if (!props.resultData) return
  loading.value = true
  htmlContent.value = ''
  try {
    const res = await client.post('/generate-page', {
      userText: props.resultData.summary || '判定分析方案',
      verdict: props.resultData.verdict,
      answers: props.resultData.decisions,
      packages: props.resultData.packages,
      dimensions: defaultDimensions
    })

    if (res.data.ok && res.data.html) {
      htmlContent.value = res.data.html
    }
  } catch (err) {
    alert(err.response?.data?.detail || '生成项目页失败')
  } finally {
    loading.value = false
  }
}

const downloadHtml = () => {
  const blob = new Blob([htmlContent.value], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `神州鲲泰_FDE_交付项目展示页.html`
  a.click()
  URL.revokeObjectURL(url)
}

const copyHtml = () => {
  navigator.clipboard.writeText(htmlContent.value)
  alert('HTML 代码已复制到剪贴板！')
}

watch(() => props.show, (val) => {
  if (val) {
    generate()
  }
})
</script>

<style scoped>
.page-modal {
  max-width: 960px;
}

.loading-state {
  text-align: center;
  padding: 60px 20px;
}

.spinner-large {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  border-radius: 50%;
  border-top-color: var(--color-primary);
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

.preview-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.iframe-container {
  width: 100%;
  height: 520px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

iframe {
  width: 100%;
  height: 100%;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
