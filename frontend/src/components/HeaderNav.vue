<template>
  <header class="site-header">
    <nav class="topbar shell" aria-label="主导航">
      <a class="brand" href="#top">
        <span class="logo-badge">神州鲲泰</span>
        <span class="logo-text">FDE 团队能力边界说明系统 (Nanobot 版)</span>
      </a>
      <div class="nav-links">
        <a href="#ai-analyzer">AI 智能判定</a>
        <a href="#decision">边界矩阵</a>
        <a href="#scope">能力范围</a>
        <a href="#packages">服务包</a>
        <a href="#stats">进化看板</a>
        <button class="btn outline" @click="$emit('open-admin')">
          ⚙️ 管理员配置
        </button>
      </div>
    </nav>
  </header>
</template>

<script setup>
defineEmits(['open-admin'])
</script>
