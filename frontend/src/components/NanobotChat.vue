<template>
  <div class="nanobot-chat">
    <!-- Floating Action Button -->
    <button
      class="nanobot-fab"
      :class="{ 'is-open': isOpen }"
      @click="toggleChat"
      :aria-label="isOpen ? '关闭 AI 助手' : '打开 AI 助手'"
    >
      <svg v-if="!isOpen" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>

    <!-- Chat Window -->
    <Transition name="nanobot-slide">
      <div v-if="isOpen" class="nanobot-window">
        <!-- Header -->
        <div class="nanobot-header">
          <div class="nanobot-header-info">
            <span class="nanobot-avatar">AI</span>
            <div>
              <h4 class="nanobot-title">FDE AI 助手</h4>
              <span class="nanobot-subtitle">Nanobot 驱动</span>
            </div>
          </div>
          <div class="nanobot-header-actions">
            <!-- Web Search Toggle Button -->
            <button
              class="nanobot-websearch-toggle"
              :class="{ 'is-active': isWebSearchEnabled }"
              @click="isWebSearchEnabled = !isWebSearchEnabled"
              :title="isWebSearchEnabled ? '关闭联网搜索' : '开启联网搜索'"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10z"/>
              </svg>
              <span>{{ isWebSearchEnabled ? '联网开启' : '联网搜索' }}</span>
            </button>
            <button class="nanobot-close" @click="isOpen = false" aria-label="关闭">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div class="nanobot-messages" ref="messagesRef">
          <!-- Welcome message -->
          <div v-if="chatMessages.length === 0" class="nanobot-welcome">
            <p class="nanobot-welcome-title">你好，有什么可以帮你？</p>
            <p class="nanobot-welcome-desc">我可以帮你了解 FDE 团队的能力边界、服务范围和工作模式。</p>
            <div class="nanobot-suggestions">
              <button
                v-for="(s, i) in suggestions"
                :key="i"
                class="nanobot-suggestion"
                @click="sendSuggestion(s)"
              >{{ s }}</button>
            </div>
          </div>

          <div
            v-for="(msg, idx) in chatMessages"
            :key="idx"
            class="nanobot-msg"
            :class="msg.role === 'user' ? 'is-user' : 'is-bot'"
          >
            <span v-if="msg.role === 'assistant'" class="nanobot-msg-avatar">AI</span>
            <div class="nanobot-msg-bubble">
              <!-- Web Search Citation Sources -->
              <div v-if="msg.searchSources && msg.searchSources.length" class="nanobot-sources-block">
                <div class="nanobot-sources-title">联网参考来源 ({{ msg.searchSources.length }})</div>
                <div class="nanobot-sources-links">
                  <a
                    v-for="(source, sIdx) in msg.searchSources"
                    :key="sIdx"
                    :href="source.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="nanobot-source-chip"
                  >
                    {{ source.title }}
                  </a>
                </div>
              </div>
              <span class="nanobot-msg-text" v-html="formatContent(msg.content)"></span>
            </div>
          </div>

          <!-- Web Searching Indicator -->
          <div v-if="isSearching" class="nanobot-msg is-bot">
            <span class="nanobot-msg-avatar">AI</span>
            <div class="nanobot-msg-bubble nanobot-search-bubble">
              <span class="nanobot-search-text">正在联网检索实时信息...</span>
            </div>
          </div>

          <!-- Streaming indicator -->
          <div v-if="isStreaming && !isSearching" class="nanobot-msg is-bot">
            <span class="nanobot-msg-avatar">AI</span>
            <div class="nanobot-msg-bubble">
              <!-- Active Search Sources during stream -->
              <div v-if="currentSearchSources && currentSearchSources.length" class="nanobot-sources-block">
                <div class="nanobot-sources-title">联网参考来源 ({{ currentSearchSources.length }})</div>
                <div class="nanobot-sources-links">
                  <a
                    v-for="(source, sIdx) in currentSearchSources"
                    :key="sIdx"
                    :href="source.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="nanobot-source-chip"
                  >
                    {{ source.title }}
                  </a>
                </div>
              </div>
              <span v-if="streamingContent" class="nanobot-msg-text" v-html="formatContent(streamingContent)"></span>
              <span v-else class="nanobot-typing">
                <i></i><i></i><i></i>
              </span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="nanobot-input-row">
          <textarea
            ref="inputRef"
            v-model="inputText"
            class="nanobot-input"
            rows="1"
            placeholder="输入你的问题..."
            :disabled="isStreaming || isSearching"
            @keydown="handleKeydown"
            @input="autoResize"
          ></textarea>
          <button
            class="nanobot-send"
            :disabled="!inputText.trim() || isStreaming || isSearching"
            @click="sendMessage"
            aria-label="发送"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true
})

const isOpen = ref(false)
const isWebSearchEnabled = ref(false)
const inputText = ref('')
const chatMessages = ref([])
const isStreaming = ref(false)
const isSearching = ref(false)
const streamingContent = ref('')
const currentSearchSources = ref([])
const messagesRef = ref(null)
const inputRef = ref(null)

const suggestions = [
  'FDE 团队能做哪些事情？',
  '神州鲲泰最新的 AI 算力产品有哪些？',
  '有哪些服务包可选？'
]

const toggleChat = () => {
  isOpen.value = !isOpen.value
}

watch(isOpen, (val) => {
  if (val) {
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

const formatContent = (text) => {
  if (!text) return ''
  try {
    return marked.parse(text)
  } catch (e) {
    return text
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

const autoResize = () => {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

const handleKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const sendSuggestion = (text) => {
  inputText.value = text
  sendMessage()
}

const sendMessage = async () => {
  const text = inputText.value.trim()
  if (!text || isStreaming.value || isSearching.value) return

  // Add user message
  chatMessages.value.push({ role: 'user', content: text })
  inputText.value = ''
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })
  scrollToBottom()

  // Start streaming
  isStreaming.value = true
  if (isWebSearchEnabled.value) {
    isSearching.value = true
  }
  streamingContent.value = ''
  currentSearchSources.value = []

  try {
    const payload = chatMessages.value.map(m => ({
      role: m.role,
      content: m.content
    }))

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: payload,
        web_search: isWebSearchEnabled.value
      })
    })

    if (!resp.ok) {
      throw new Error(`服务异常 [${resp.status}]`)
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIdx
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const rawLine = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)

        for (const line of rawLine.split('\n')) {
          if (!line.startsWith('data:')) continue
          const dataStr = line.slice(5).trim()
          if (dataStr === '[DONE]') continue

          try {
            const parsed = JSON.parse(dataStr)
            if (parsed.error) {
              throw new Error(parsed.error)
            }
            if (parsed.type === 'search' && Array.isArray(parsed.results)) {
              currentSearchSources.value = parsed.results
              isSearching.value = false
              scrollToBottom()
            }
            if (parsed.content) {
              isSearching.value = false
              fullContent += parsed.content
              streamingContent.value = fullContent
              scrollToBottom()
            }
          } catch (parseErr) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr
            }
          }
        }
      }
    }

    // Commit streamed content as bot message
    if (fullContent) {
      chatMessages.value.push({
        role: 'assistant',
        content: fullContent,
        searchSources: currentSearchSources.value.length ? [...currentSearchSources.value] : null
      })
    }
  } catch (err) {
    chatMessages.value.push({
      role: 'assistant',
      content: `抱歉，遇到了问题: ${err.message || '请稍后再试'}`
    })
  } finally {
    isStreaming.value = false
    isSearching.value = false
    streamingContent.value = ''
    currentSearchSources.value = []
    scrollToBottom()
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}
</script>

