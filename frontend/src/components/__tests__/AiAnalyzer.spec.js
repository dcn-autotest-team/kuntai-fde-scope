import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AiAnalyzer from '../AiAnalyzer.vue'


const encode = value => new TextEncoder().encode(value)

function responseFrom(chunks, ok = true, status = 200) {
  let index = 0
  return {
    ok,
    status,
    body: {
      getReader: () => ({
        read: vi.fn(async () => index < chunks.length
          ? { done: false, value: encode(chunks[index++]) }
          : { done: true })
      })
    }
  }
}


describe('AiAnalyzer', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('parses the complete SSE lifecycle and emits result actions', async () => {
    const stream = [
      ': connected\n\n',
      'event: plan\ndata: {"reasoning":"分析计划","steps":[1,2]}\n\n',
      'event: tool_start\ndata: {"label":"校验","purpose":"检查输入"}\n\n',
      'event: tool_result\ndata: {"label":"校验","summary":"通过"}\n\n',
      'event: reflection\ndata: {"summary":"反思摘要"}\n\n',
      'event: done\ndata: {"valid":true,"verdict":"can","total":8,"summary":"完成"}\n\n'
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(responseFrom(stream)))
    const wrapper = mount(AiAnalyzer)
    await wrapper.find('textarea').setValue('企业知识库需求')
    await wrapper.find('.ai-tools-bar .btn').trigger('click')
    await flushPromises()

    expect(fetch).toHaveBeenCalledWith('/api/agent/analyze', expect.objectContaining({ method: 'POST' }))
    expect(wrapper.findAll('.trace-item')).toHaveLength(5)
    expect(wrapper.find('.result-box').classes()).toContain('can')
    expect(wrapper.text()).toContain('可以做')

    const actions = wrapper.findAll('.result-actions button')
    await actions[0].trigger('click')
    await actions[1].trigger('click')
    expect(wrapper.emitted('sync-decision')[0][0].total).toBe(8)
    expect(wrapper.emitted('generate-page')).toHaveLength(1)
  })

  it('renders invalid requirement and explicit error events', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(responseFrom(['event: done\ndata: {"valid":false,"validityReason":"描述无效"}\n\n']))
      .mockResolvedValueOnce(responseFrom(['event: error\ndata: {"message":"执行失败"}\n\n'])))
    const wrapper = mount(AiAnalyzer)
    await wrapper.find('textarea').setValue('有效长度文本')
    await wrapper.find('.ai-tools-bar .btn').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('描述无效')

    await wrapper.find('.ai-tools-bar .btn').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('执行失败')
  })

  it('handles HTTP and malformed JSON errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(responseFrom(['event: plan\ndata: invalid\n\n']))
      .mockResolvedValueOnce(responseFrom([], false, 503)))
    const wrapper = mount(AiAnalyzer)
    await wrapper.find('textarea').setValue('有效长度文本')
    await wrapper.find('.ai-tools-bar .btn').trigger('click')
    await flushPromises()
    expect(consoleSpy).toHaveBeenCalled()

    await wrapper.find('.ai-tools-bar .btn').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('服务器错误 [503]')
    consoleSpy.mockRestore()
  })

  it('reads uploaded text documents', async () => {
    class Reader {
      readAsText(file) {
        this.onload({ target: { result: '文档内容' } })
      }
    }
    vi.stubGlobal('FileReader', Reader)
    const wrapper = mount(AiAnalyzer)
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [new File(['x'], 'req.md')] })
    await input.trigger('change')
    expect(wrapper.text()).toContain('req.md')
    expect(wrapper.find('.ai-tools-bar .btn').attributes('disabled')).toBeUndefined()
  })
})

