<template>
  <header class="site-header">
    <nav class="topbar shell" aria-label="主导航">
      <a class="brand" href="#top">
        <img :src="logoUrl" alt="神州鲲泰 Logo" class="brand-logo" />
        <span class="logo-divider">|</span>
        <span class="logo-text">FDE 团队能力边界说明系统 (Nanobot 版)</span>
      </a>
      <div class="nav-links">
        <a href="#ai-analyzer">AI 智能判定</a>
        <a href="#decision">边界矩阵</a>
        <a href="#scope">能力范围</a>
        <a href="#packages">服务包</a>
        <a href="#stats">进化看板</a>
        <button class="btn header-admin-btn" @click="$emit('open-admin')">
          管理员配置
        </button>
      </div>
    </nav>
  </header>
</template>

<script setup>
import logoUrl from '../assets/logo.png'
defineEmits(['open-admin'])
</script>

<style scoped>
.brand-logo {
  height: 32px;
  width: auto;
  object-fit: contain;
  display: block;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.brand-logo:hover {
  transform: scale(1.04);
}

.logo-divider {
  color: #cbd5e1;
  font-size: 18px;
  font-weight: 300;
  margin: 0 4px;
}

.logo-text {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.2px;
}

.header-admin-btn {
  background: transparent;
  border: 1px solid #111827;
  color: #111827;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: var(--transition);
}

.header-admin-btn:hover {
  background: #f3f4f6;
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
