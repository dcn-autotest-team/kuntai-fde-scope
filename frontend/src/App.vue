<template>
  <div class="app-root">
    <HeaderNav @open-admin="showAdminModal = true" />
    <main>
      <HeroSection />
      <AiAnalyzer
        @sync-decision="handleSyncDecision"
        @generate-page="handleGeneratePage"
      />
      <DecisionMatrix :ai-decisions="syncedDecisions" />
      <ScopeSection />
      <PackageSection />
      <StatsDashboard />
    </main>

    <AdminModal
      :show="showAdminModal"
      @close="showAdminModal = false"
    />

    <PageGeneratorModal
      :show="showPageModal"
      :result-data="activeResultData"
      @close="showPageModal = false"
    />

    <NanobotChat />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import HeaderNav from './components/HeaderNav.vue'
import HeroSection from './components/HeroSection.vue'
import AiAnalyzer from './components/AiAnalyzer.vue'
import DecisionMatrix from './components/DecisionMatrix.vue'
import ScopeSection from './components/ScopeSection.vue'
import PackageSection from './components/PackageSection.vue'
import StatsDashboard from './components/StatsDashboard.vue'
import AdminModal from './components/AdminModal.vue'
import PageGeneratorModal from './components/PageGeneratorModal.vue'
import NanobotChat from './components/NanobotChat.vue'

const showAdminModal = ref(false)
const showPageModal = ref(false)
const syncedDecisions = ref(null)
const activeResultData = ref(null)

const handleSyncDecision = (result) => {
  syncedDecisions.value = result
  const el = document.getElementById('decision')
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' })
  }
}

const handleGeneratePage = (result) => {
  activeResultData.value = result
  showPageModal.value = true
}
</script>

<style>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
