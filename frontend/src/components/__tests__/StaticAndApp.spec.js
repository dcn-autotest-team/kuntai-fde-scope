import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import App from '../../App.vue'
import HeaderNav from '../HeaderNav.vue'
import HeroSection from '../HeroSection.vue'
import PackageSection from '../PackageSection.vue'
import ScopeSection from '../ScopeSection.vue'


describe('static sections', () => {
  it('renders navigation and emits the admin action', async () => {
    const wrapper = mount(HeaderNav)
    await wrapper.find('.header-admin-btn').trigger('click')
    expect(wrapper.emitted('open-admin')).toHaveLength(1)
    expect(wrapper.find('img').attributes('src')).toBeTruthy()
  })

  it('renders hero, scope and package content', () => {
    expect(mount(HeroSection).findAll('.hero-stats > div')).toHaveLength(3)
    expect(mount(ScopeSection).findAll('.scope-card')).toHaveLength(2)
    expect(mount(PackageSection).findAll('.package-card')).toHaveLength(5)
  })
})


describe('App', () => {
  const stubs = {
    HeaderNav: { template: '<button class="open-admin" @click="$emit(\'open-admin\')">admin</button>' },
    HeroSection: true,
    AiAnalyzer: { template: '<div><button class="sync" @click="$emit(\'sync-decision\', { caseId: \'c1\' })">sync</button><button class="generate" @click="$emit(\'generate-page\', { verdict: \'can\' })">generate</button></div>' },
    DecisionMatrix: { props: ['aiDecisions'], template: '<div id="decision">{{ aiDecisions?.caseId }}</div>' },
    ScopeSection: true,
    PackageSection: true,
    StatsDashboard: true,
    AdminModal: { props: ['show'], template: '<div class="admin-state" @click="$emit(\'close\')">{{ show }}</div>' },
    PageGeneratorModal: { props: ['show', 'resultData'], template: '<div class="page-state" @click="$emit(\'close\')">{{ show }}-{{ resultData?.verdict }}</div>' },
    NanobotChat: true
  }

  it('coordinates analyzer results and modal state', async () => {
    const wrapper = mount(App, { global: { stubs } })
    const scrollIntoView = vi.fn()
    const getElement = vi.spyOn(document, 'getElementById').mockReturnValue({ scrollIntoView })

    await wrapper.find('.open-admin').trigger('click')
    expect(wrapper.find('.admin-state').text()).toBe('true')
    await wrapper.find('.admin-state').trigger('click')
    expect(wrapper.find('.admin-state').text()).toBe('false')

    await wrapper.find('.sync').trigger('click')
    expect(wrapper.find('#decision').text()).toBe('c1')
    expect(scrollIntoView).toHaveBeenCalled()

    await wrapper.find('.generate').trigger('click')
    expect(wrapper.find('.page-state').text()).toBe('true-can')
    await wrapper.find('.page-state').trigger('click')
    expect(wrapper.find('.page-state').text()).toBe('false-can')
    getElement.mockRestore()
  })
})
