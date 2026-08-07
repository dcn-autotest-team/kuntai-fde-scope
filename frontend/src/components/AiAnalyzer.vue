<template>
  <section id="ai-analyzer" class="section">
    <div class="shell">
      <div class="section-header">
        <h2>Nanobot 智能 Agent 边界判定</h2>
        <p>基于 Nanobot 微智能体引擎，自主感知需求、检索历史库、规划分析步骤并实时流式输出。</p>
      </div>

      <div class="card ai-card">
        <div class="ai-input-wrapper">
          <textarea
            v-model="userText"
            rows="4"
            class="ai-textarea"
            placeholder="请输入客户 AI 应用落地需求描述，例如：客户是一家制造企业，希望用 AI 做质检报告自动生成，已有 GPU 服务器，想先做一个 PoC 验证效果..."
          ></textarea>
          
          <div class="ai-tools-bar">
            <div class="file-inputs">
              <label class="file-btn">
                文本/文档 (.txt/.md)
                <input type="file" accept=".txt,.md" hidden @change="handleDocUpload" />
              </label>
              <span v-if="docFileName" class="file-tag">{{ docFileName }}</span>
            </div>

            <button
              class="btn primary"
              :disabled="analyzing || (!userText.trim() && !docText)"
              @click="startAnalysis"
            >
              <span v-if="analyzing" class="spinner"></span>
              {{ analyzing ? 'Nanobot 分析中...' : '开始智能判定' }}
            </button>
          </div>
        </div>

        <!-- SSE Pipeline Trace -->
        <div v-if="traceLogs.length > 0" class="trace-container">
          <div class="trace-header">
            <h4>Nanobot Agent 实时执行轨迹</h4>
            <span class="status-tag" :class="traceStatus">{{ traceStatusText }}</span>
          </div>

          <div class="trace-timeline">
            <div
              v-for="(log, idx) in traceLogs"
              :key="idx"
              class="trace-item"
              :class="log.type"
            >
              <div class="trace-icon">
                <span class="trace-bullet"></span>
              </div>
              <div class="trace-body">
                <div class="trace-title">{{ log.title }}</div>
                <div v-if="log.detail" class="trace-detail">{{ log.detail }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Final Agent Result Box -->
        <div v-if="finalResult" class="result-box" :class="finalResult.verdict">
          <div class="result-header">
            <h3>判定结论：{{ verdictText(finalResult.verdict) }}</h3>
            <span class="score-badge">总得分: {{ finalResult.total }} 分</span>
          </div>
          <p class="summary-text">{{ finalResult.summary }}</p>

          <div class="result-actions">
            <button class="btn primary" @click="$emit('sync-decision', finalResult)">
              将 AI 建议同步至 6 维矩阵
            </button>
            <button class="btn outline-dark" @click="$emit('generate-page', finalResult)">
              生成交付项目 HTML 页
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

const emit = defineEmits(['sync-decision', 'generate-page'])

const userText = ref('')
const docText = ref('')
const docFileName = ref('')
const analyzing = ref(false)
const traceLogs = ref([])
const traceStatus = ref('idle')
const traceStatusText = ref('未开始')
const finalResult = ref(null)

const handleDocUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  docFileName.value = file.name
  const reader = new FileReader()
  reader.onload = (evt) => {
    docText.value = evt.target.result || ''
  }
  reader.readAsText(file)
}

const verdictText = (v) => {
  if (v === 'can') return '可以做（属于 FDE 能力范围）'
  if (v === 'maybe') return '谨慎做（需要外部支持）'
  return '不能独立承接（触犯红线或超界）'
}

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

const startAnalysis = async () => {
  analyzing.value = true
  traceLogs.value = []
  finalResult.value = null
  traceStatus.value = 'running'
  traceStatusText.value = '分析中'

  try {
    const resp = await fetch('/api/agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: userText.value,
        docText: docText.value,
        dimensions: defaultDimensions
      })
    })

    if (!resp.ok) {
      throw new Error(`服务器错误 [${resp.status}]`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const block of lines) {
        if (!block.trim() || block.startsWith(':')) continue

        let eventName = 'message'
        let dataStr = ''

        for (const line of block.split('\n')) {
          if (line.startsWith('event: ')) {
            eventName = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            dataStr = line.slice(6).trim()
          }
        }

        if (!dataStr) continue
        try {
          const data = JSON.parse(dataStr)
          handleSseEvent(eventName, data)
        } catch (e) {
          console.error('JSON parse error', e, dataStr)
        }
      }
    }
  } catch (err) {
    traceLogs.value.push({
      type: 'error',
      title: '错误',
      detail: err.message || '连接中断'
    })
    traceStatus.value = 'error'
    traceStatusText.value = '失败'
  } finally {
    analyzing.value = false
  }
}

const handleSseEvent = (event, data) => {
  if (event === 'plan') {
    traceLogs.value.push({
      type: 'plan',
      title: 'Nanobot 自主规划',
      detail: `${data.reasoning} (${data.steps.length} 步)`
    })
  } else if (event === 'tool_start') {
    traceLogs.value.push({
      type: 'tool_start',
      title: `开始: ${data.label}`,
      detail: data.purpose
    })
  } else if (event === 'tool_result') {
    traceLogs.value.push({
      type: 'tool_result',
      title: `完成: ${data.label}`,
      detail: data.summary
    })
  } else if (event === 'reflection') {
    traceLogs.value.push({
      type: 'reflection',
      title: '架构师反思',
      detail: data.summary
    })
  } else if (event === 'done') {
    traceStatus.value = 'completed'
    traceStatusText.value = '已完成'
    if (data.valid) {
      finalResult.value = data
      traceLogs.value.push({
        type: 'done',
        title: '分析完成',
        detail: `得分: ${data.total} 分, 结论: ${verdictText(data.verdict)}`
      })
    } else {
      traceLogs.value.push({
        type: 'error',
        title: '需求无效',
        detail: data.validityReason
      })
    }
  } else if (event === 'error') {
    traceStatus.value = 'error'
    traceStatusText.value = '错误'
    traceLogs.value.push({
      type: 'error',
      title: '执行出错',
      detail: data.message
    })
  }
}
</script>

<style scoped>
.ai-textarea {
  width: 100%;
  padding: 16px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: 15px;
  font-family: inherit;
  resize: vertical;
  outline: none;
  transition: var(--transition);
}

.ai-textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(196, 18, 48, 0.1);
}

.ai-tools-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.file-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-btn {
  background: #f1f5f9;
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--color-border);
  transition: var(--transition);
}

.file-btn:hover {
  background: #e2e8f0;
}

.file-tag {
  font-size: 13px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 4px 10px;
  border-radius: var(--radius-sm);
}

/* Trace styles */
.trace-container {
  margin-top: 28px;
  background: #0a0a0c;
  color: #f3f4f6;
  border-radius: var(--radius-md);
  padding: 20px;
  border-top: 2px solid var(--color-primary);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
}

.trace-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  border-bottom: 1px solid #27272a;
  padding-bottom: 12px;
}

.status-tag {
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.status-tag.running {
  background: #18181b;
  color: var(--color-accent);
  border: 1px solid var(--color-primary);
  animation: pulseRedGlow 2s infinite;
}

.status-tag.completed {
  background: #0f172a;
  color: #ffffff;
  border: 1px solid #4b5563;
}

.status-tag.error {
  background: #fef2f2;
  color: var(--color-primary);
  border: 1px solid #fca5a5;
}

.trace-timeline {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 280px;
  overflow-y: auto;
}

.trace-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: #141418;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  border-left: 2px solid #27272a;
  transition: var(--transition);
}

.trace-item:hover {
  transform: translateX(4px);
  border-left-color: var(--color-primary);
  background: #1c1c22;
}

.trace-bullet {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 6px var(--color-accent);
  margin-top: 6px;
}

.trace-title {
  font-weight: 600;
  color: #f9fafb;
}

.trace-detail {
  color: #9ca3af;
  margin-top: 2px;
}

/* Result box */
.result-box {
  margin-top: 28px;
  padding: 24px;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.result-box.can {
  background: #0a0a0c;
  border-color: var(--color-primary);
  color: #ffffff;
  box-shadow: 0 12px 32px rgba(196, 18, 48, 0.2);
}

.result-box.can .summary-text {
  color: #d1d5db;
}

.result-box.can .score-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.result-box.maybe {
  background: #f8fafc;
  border-color: #9ca3af;
  color: #0f172a;
}

.result-box.no {
  background: #fef2f2;
  border-color: var(--color-primary);
  color: #0f172a;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.score-badge {
  font-weight: 700;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.06);
  padding: 4px 12px;
  border-radius: 999px;
}

.summary-text {
  font-size: 15px;
  color: var(--color-text-main);
  line-height: 1.6;
  margin-bottom: 20px;
}

.result-actions {
  display: flex;
  gap: 12px;
}

.btn.outline-dark {
  border: 1px solid var(--color-border);
  color: inherit;
  background: transparent;
}

.btn.outline-dark:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-primary);
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #fff;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
