<template>
  <div v-if="show" class="modal-backdrop" @click.self="$emit('close')">
    <div class="modal-content admin-modal">
      <div class="modal-header">
        <h3>⚙️ 管理员后台 (AI 配置与经验库策展)</h3>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <!-- Login View -->
      <div v-if="!isLoggedIn" class="login-view">
        <p class="login-desc">请输入管理员密码进入配置管理：</p>
        <div class="form-group">
          <input
            v-model="password"
            type="password"
            class="form-input"
            placeholder="管理员密码"
            @keyup.enter="handleLogin"
          />
        </div>
        <button class="btn primary full-width" :disabled="loggingIn" @click="handleLogin">
          {{ loggingIn ? '验证中...' : '登录管理员' }}
        </button>
        <p v-if="loginError" class="error-msg">{{ loginError }}</p>
      </div>

      <!-- Logged In Panel -->
      <div v-else class="admin-panel">
        <div class="tabs">
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'config' }"
            @click="activeTab = 'config'"
          >
            ⚙️ AI 服务参数配置
          </button>
          <button
            class="tab-btn"
            :class="{ active: activeTab === 'lessons' }"
            @click="loadLessons"
          >
            📚 沉淀经验库策展 ({{ lessons.length }})
          </button>
        </div>

        <!-- Tab 1: AI Config -->
        <div v-if="activeTab === 'config'" class="tab-content">
          <div class="form-group">
            <label>API Endpoint (接口地址)</label>
            <input v-model="aiConfig.endpoint" type="text" class="form-input" />
          </div>
          <div class="form-group">
            <label>API Key (密钥，仅存储于后端)</label>
            <input v-model="aiConfig.apiKey" type="password" class="form-input" placeholder="输入新密钥" />
          </div>
          <div class="form-group">
            <label>Model (模型名称)</label>
            <input v-model="aiConfig.model" type="text" class="form-input" />
          </div>

          <div class="form-actions">
            <button class="btn primary" :disabled="savingConfig" @click="saveConfig">
              {{ savingConfig ? '保存中...' : '💾 保存 AI 参数配置' }}
            </button>
          </div>
          <p v-if="configSuccessMsg" class="success-msg">{{ configSuccessMsg }}</p>
        </div>

        <!-- Tab 2: Evolutionary Lessons Curation -->
        <div v-if="activeTab === 'lessons'" class="tab-content">
          <div class="lessons-list">
            <div v-for="item in lessons" :key="item.id" class="lesson-card">
              <div class="lesson-head">
                <span class="dim-tag">维度: {{ item.dimensionId || '通用' }}</span>
                <div class="lesson-actions">
                  <button class="btn-sm primary" @click="editLesson(item)">编辑</button>
                  <button class="btn-sm danger" @click="deleteLesson(item.id)">删除</button>
                </div>
              </div>

              <!-- Edit mode -->
              <div v-if="editingId === item.id" class="edit-box">
                <textarea v-model="editForm.lesson" rows="2" class="form-input"></textarea>
                <div class="edit-btns">
                  <button class="btn-sm primary" @click="saveLessonEdit(item.id)">保存</button>
                  <button class="btn-sm secondary" @click="editingId = null">取消</button>
                </div>
              </div>

              <!-- Normal display -->
              <div v-else>
                <p class="lesson-text">{{ item.lesson }}</p>
                <p v-if="item.context" class="lesson-context">来源上下文: {{ item.context }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import client from '../api/client'

const props = defineProps({
  show: Boolean
})
defineEmits(['close'])

const password = ref('')
const loggingIn = ref(false)
const loginError = ref('')
const isLoggedIn = ref(Boolean(localStorage.getItem('kuntai_admin_token')))

const activeTab = ref('config')
const aiConfig = ref({
  endpoint: '',
  apiKey: '',
  model: ''
})
const savingConfig = ref(false)
const configSuccessMsg = ref('')

const lessons = ref([])
const editingId = ref(null)
const editForm = ref({ lesson: '' })

const handleLogin = async () => {
  loggingIn.value = true
  loginError.value = ''
  try {
    const res = await client.post('/admin/login', { password: password.value })
    if (res.data.ok && res.data.token) {
      localStorage.setItem('kuntai_admin_token', res.data.token)
      isLoggedIn.value = true
      if (res.data.config) {
        aiConfig.value = res.data.config
      }
    } else {
      loginError.value = res.data.message || '密码错误'
    }
  } catch (err) {
    loginError.value = err.response?.data?.detail || '登录失败'
  } finally {
    loggingIn.value = false
  }
}

const saveConfig = async () => {
  savingConfig.value = true
  configSuccessMsg.value = ''
  try {
    const res = await client.post('/config', aiConfig.value)
    if (res.data.ok) {
      configSuccessMsg.value = 'AI 服务参数配置更新成功！'
    }
  } catch (err) {
    alert(err.response?.data?.detail || '保存失败')
  } finally {
    savingConfig.value = false
  }
}

const loadLessons = async () => {
  activeTab.value = 'lessons'
  try {
    const res = await client.get('/admin/lessons')
    if (res.data.ok) {
      lessons.value = res.data.lessons
    }
  } catch (err) {
    alert('未能获取经验列表')
  }
}

const editLesson = (item) => {
  editingId.value = item.id
  editForm.value = { lesson: item.lesson }
}

const saveLessonEdit = async (id) => {
  try {
    const res = await client.put(`/admin/lessons/${id}`, editForm.value)
    if (res.data.ok) {
      editingId.value = null
      loadLessons()
    }
  } catch (err) {
    alert('保存修改失败')
  }
}

const deleteLesson = async (id) => {
  if (!confirm('确定要删除这条经验条目吗？删除后不可恢复。')) return
  try {
    const res = await client.delete(`/admin/lessons/${id}`)
    if (res.data.ok) {
      loadLessons()
    }
  } catch (err) {
    alert('删除失败')
  }
}

watch(() => props.show, (val) => {
  if (val && isLoggedIn.value) {
    client.get('/config').then(res => {
      if (res.data) {
        aiConfig.value.endpoint = res.data.endpoint
        aiConfig.value.model = res.data.model
      }
    })
  }
})
</script>

<style scoped>
.admin-modal {
  max-width: 680px;
}

.login-view {
  padding: 20px 0;
}

.login-desc {
  font-size: 14px;
  color: var(--color-text-sub);
  margin-bottom: 16px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  font-size: 14px;
  font-family: inherit;
}

.full-width {
  width: 100%;
}

.error-msg {
  color: #dc2626;
  font-size: 13px;
  margin-top: 12px;
}

.success-msg {
  color: #16a34a;
  font-size: 13px;
  margin-top: 12px;
}

.tabs {
  display: flex;
  gap: 12px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 20px;
}

.tab-btn {
  background: none;
  border: none;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: var(--color-text-sub);
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.lessons-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.lesson-card {
  background: #f8fafc;
  border-radius: var(--radius-sm);
  padding: 14px;
  border: 1px solid var(--color-border);
}

.lesson-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dim-tag {
  font-size: 11px;
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.lesson-actions {
  display: flex;
  gap: 6px;
}

.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}

.btn-sm.primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-sm.secondary {
  background: #cbd5e1;
  color: #0f172a;
}

.btn-sm.danger {
  background: #ef4444;
  color: #fff;
}

.lesson-text {
  font-size: 13px;
  font-weight: 500;
}

.lesson-context {
  font-size: 12px;
  color: #64748b;
  margin-top: 4px;
}

.edit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-btns {
  display: flex;
  gap: 8px;
}
</style>
