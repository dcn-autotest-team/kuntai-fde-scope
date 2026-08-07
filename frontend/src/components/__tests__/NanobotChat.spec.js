import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import NanobotChat from '../NanobotChat.vue'


const encode = value => new TextEncoder().encode(value)

function responseFrom(chunks, ok = true, status = 200) {
  let index = 0
  return {
    ok,
    status,
    body: { getReader: () => ({ read: async () => index < chunks.length ? { done: false, value: encode(chunks[index++]) } : { done: true } }) }
  }
}


describe('NanobotChat', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens, searches, streams content and renders sources', async () => {
    const payload = [
      'data: invalid\n\n',
      'data: {"type":"search","results":[{"title":"来源","url":"https://source"}]}\n\n',
      'ignored: line\ndata: {"content":"**回答**"}\n\n',
      'data: [DONE]\n\n'
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFrom(payload)))
    const wrapper = mount(NanobotChat)
    await wrapper.find('.nanobot-fab').trigger('click')
    expect(wrapper.find('.nanobot-window').exists()).toBe(true)
    await wrapper.find('.nanobot-websearch-toggle').trigger('click')
    await wrapper.find('textarea').setValue('问题')
    await wrapper.find('.nanobot-send').trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/chat', expect.objectContaining({ method: 'POST' }))
    expect(wrapper.find('.nanobot-source-chip').text()).toBe('来源')
    expect(wrapper.find('.nanobot-msg-text strong').text()).toBe('回答')
  })

  it('sends suggestions and handles HTTP or stream errors', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(responseFrom([], false, 500))
      .mockResolvedValueOnce(responseFrom(['data: {"error":"模型失败"}\n\n'])))
    const wrapper = mount(NanobotChat)
    await wrapper.find('.nanobot-fab').trigger('click')
    await wrapper.find('.nanobot-suggestion').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('服务异常 [500]')

    await wrapper.find('textarea').setValue('第二个问题')
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', shiftKey: false })
    await flushPromises()
    expect(wrapper.text()).toContain('模型失败')
  })

  it('supports resize, shifted enter and close controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFrom([])))
    const wrapper = mount(NanobotChat)
    await wrapper.find('.nanobot-fab').trigger('click')
    const input = wrapper.find('textarea')
    Object.defineProperty(input.element, 'scrollHeight', { value: 200 })
    await input.trigger('input')
    expect(input.element.style.height).toBe('120px')
    await input.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(fetch).not.toHaveBeenCalled()
    await wrapper.find('.nanobot-close').trigger('click')
    expect(wrapper.find('.nanobot-window').exists()).toBe(false)
  })
})

