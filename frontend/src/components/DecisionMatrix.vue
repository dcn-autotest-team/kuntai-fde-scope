<template>
  <section id="decision" class="section">
    <div class="shell">
      <div class="section-header">
        <h2>6 维需求判定矩阵</h2>
        <p>从业务价值、交付形态、技术内容、环境协同、风险边界与上线运营 6 个维度手动复核计算得分。</p>
      </div>

      <div class="card matrix-card">
        <div class="matrix-grid">
          <div
            v-for="(item, dIdx) in dimensions"
            :key="item.id"
            class="dimension-item"
          >
            <div class="dimension-header">
              <span class="dim-number">0{{ dIdx + 1 }}</span>
              <h3>{{ item.title }}</h3>
            </div>

            <div class="options-list">
              <label
                v-for="(opt, oIdx) in item.options"
                :key="oIdx"
                class="option-label"
                :class="{ selected: selectedMap[item.id] === oIdx, redflag: opt.redflag }"
              >
                <input
                  type="radio"
                  :name="'dim_' + item.id"
                  :value="oIdx"
                  v-model="selectedMap[item.id]"
                />
                <span class="opt-text">{{ opt.label }}</span>
                <span class="opt-score" :class="{ negative: opt.score < 0 }">
                  {{ opt.score > 0 ? '+' + opt.score : opt.score }}分
                  <template v-if="opt.redflag">[红线]</template>
                </span>
              </label>
            </div>
          </div>
        </div>

        <!-- Realtime Score & Verdict Summary Bar -->
        <div class="summary-bar" :class="calculatedVerdict">
          <div class="summary-info">
            <div class="score-display">
              <span>综合打分: </span>
              <strong>{{ totalScore }} 分</strong>
            </div>
            <div class="verdict-display">
              <span>判定结论: </span>
              <span class="badge" :class="calculatedVerdict">{{ calculatedVerdictText }}</span>
            </div>
          </div>

          <div class="feedback-action">
            <button
              class="btn primary"
              :disabled="submittingFeedback || !currentCaseId"
              @click="submitFeedback"
            >
              {{ submittingFeedback ? '沉淀中...' : '确认选择并沉淀进化经验' }}
            </button>
            <span v-if="!currentCaseId" class="hint-text">（需先在 AI 智能判定中发起评测）</span>
          </div>
        </div>

        <div v-if="feedbackSuccessMsg" class="feedback-success">
          {{ feedbackSuccessMsg }}
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import client from '../api/client'

const props = defineProps({
  aiDecisions: {
    type: Object,
    default: null
  }
})

const currentCaseId = ref(null)

const dimensions = ref([
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
])

const selectedMap = ref({
  value: 0,
  solution_type: 0,
  tech_scope: 0,
  environment: 0,
  risk: 0,
  operation: 0
})

watch(() => props.aiDecisions, (newVal) => {
  if (!newVal) return
  if (newVal.caseId) {
    currentCaseId.value = newVal.caseId
  }
  if (newVal.decisions && Array.isArray(newVal.decisions)) {
    for (const d of newVal.decisions) {
      if (d.dimension_id && d.option_index !== undefined) {
        selectedMap.value[d.dimension_id] = Number(d.option_index)
      }
    }
  }
}, { immediate: true })

const totalScore = computed(() => {
  let sum = 0
  for (const dim of dimensions.value) {
    const idx = selectedMap.value[dim.id]
    if (idx !== undefined && dim.options[idx]) {
      sum += dim.options[idx].score
    }
  }
  return sum
})

const hasRedflag = computed(() => {
  for (const dim of dimensions.value) {
    const idx = selectedMap.value[dim.id]
    if (idx !== undefined && dim.options[idx] && dim.options[idx].redflag) {
      return true
    }
  }
  return false
})

const calculatedVerdict = computed(() => {
  if (hasRedflag.value) return 'no'
  if (totalScore.value >= 8) return 'can'
  if (totalScore.value >= 4) return 'maybe'
  return 'no'
})

const calculatedVerdictText = computed(() => {
  if (calculatedVerdict.value === 'can') return '可以做（属于 FDE 能力范围）'
  if (calculatedVerdict.value === 'maybe') return '谨慎做（需要外部支持/协同）'
  return '不能独立承接（触犯红线场景）'
})

const submittingFeedback = ref(false)
const feedbackSuccessMsg = ref('')

const submitFeedback = async () => {
  if (!currentCaseId.value) return
  submittingFeedback.value = true
  feedbackSuccessMsg.value = ''

  try {
    const confirmations = Object.keys(selectedMap.value).map(k => ({
      dimension_id: k,
      option_index: selectedMap.value[k]
    }))

    const res = await client.post('/agent/feedback', {
      caseId: currentCaseId.value,
      confirmations
    })

    if (res.data.ok) {
      let msg = '人工确认已提交'
      if (res.data.lessons && res.data.lessons.length > 0) {
        msg += `，沉淀了 ${res.data.lessons.length} 条反思经验条目！`
      } else {
        msg += '，案例历史已同步更新！'
      }
      feedbackSuccessMsg.value = msg
    }
  } catch (err) {
    alert(err.response?.data?.detail || '提交失败')
  } finally {
    submittingFeedback.value = false
  }
}
</script>

<style scoped>
.matrix-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 24px;
}

.dimension-item {
  background: #f8fafc;
  border-radius: var(--radius-md);
  padding: 20px;
  border: 1px solid var(--color-border);
}

.dimension-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.dim-number {
  font-weight: 800;
  color: var(--color-primary);
  font-size: 18px;
}

.dimension-header h3 {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.option-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  transition: var(--transition);
}

.option-label:hover {
  border-color: #9ca3af;
  transform: translateX(2px);
}

.option-label.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(196, 18, 48, 0.12);
}

.option-label.redflag.selected {
  border-color: var(--color-primary);
  background: #fef2f2;
}

.opt-score {
  font-weight: 700;
  color: #111827;
}

.opt-score.negative {
  color: var(--color-primary);
}

.summary-bar {
  margin-top: 32px;
  padding: 24px;
  border-radius: var(--radius-md);
  background: #0a0a0c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 2px solid var(--color-primary);
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.3);
}

.summary-info {
  display: flex;
  gap: 32px;
  align-items: center;
}

.score-display strong {
  font-size: 26px;
  color: var(--color-accent);
  margin-left: 6px;
}

.feedback-action {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint-text {
  font-size: 12px;
  color: #9ca3af;
}

.feedback-success {
  margin-top: 16px;
  padding: 12px;
  background: #000000;
  color: #ffffff;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-weight: 600;
  text-align: center;
  box-shadow: 0 4px 16px rgba(196, 18, 48, 0.2);
  animation: fadeInUp 0.25s ease;
}
</style>
