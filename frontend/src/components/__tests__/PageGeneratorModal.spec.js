import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import client from '../../api/client'
import PageGeneratorModal from '../PageGeneratorModal.vue'


vi.mock('../../api/client', () => ({ default: { post: vi.fn() } }))


const resultData = {
  summary: '方案摘要',
  verdict: 'can',
  decisions: [{ dimension_id: 'risk', option_index: 0 }],
  packages: [{ title: '诊断' }]
}


describe('PageGeneratorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
  })

  it('generates, copies and downloads HTML', async () => {
    client.post.mockResolvedValue({ data: { ok: true, html: '<html>ok</html>' } })
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    URL.createObjectURL = vi.fn(() => 'blob:test')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const wrapper = mount(PageGeneratorModal, { props: { show: false, resultData } })
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(client.post).toHaveBeenCalledWith('/generate-page', expect.objectContaining({ verdict: 'can' }))
    expect(wrapper.find('iframe').attributes('srcdoc')).toBe('<html>ok</html>')

    const buttons = wrapper.findAll('.preview-actions button')
    await buttons[0].trigger('click')
    await buttons[1].trigger('click')
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    expect(writeText).toHaveBeenCalledWith('<html>ok</html>')
    await wrapper.find('.modal-close').trigger('click')
    await wrapper.find('.modal-backdrop').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
    click.mockRestore()
  })

  it('does nothing without result data and supports retry after failure', async () => {
    const empty = mount(PageGeneratorModal, { props: { show: true, resultData: null } })
    await flushPromises()
    expect(client.post).not.toHaveBeenCalled()
    expect(empty.find('.error-state').exists()).toBe(true)

    client.post.mockRejectedValue({ response: { data: { detail: '生成失败' } } })
    await empty.setProps({ resultData })
    await empty.find('.error-state button').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('生成失败')
  })

  it('uses the fallback summary and keeps the error state for empty responses', async () => {
    client.post.mockResolvedValue({ data: { ok: true, html: '' } })
    const wrapper = mount(PageGeneratorModal, { props: { show: false, resultData: { ...resultData, summary: '' } } })
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(client.post).toHaveBeenCalledWith('/generate-page', expect.objectContaining({ userText: '判定分析方案' }))
    expect(wrapper.find('.error-state').exists()).toBe(true)
  })
})
