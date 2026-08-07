import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import client from '../../api/client'
import DecisionMatrix from '../DecisionMatrix.vue'


vi.mock('../../api/client', () => ({
  default: {
    post: vi.fn()
  }
}))


describe('DecisionMatrix', () => {
  beforeEach(() => {
    client.post.mockReset()
  })

  it('starts with the maximum score and disables feedback without a case', () => {
    const wrapper = mount(DecisionMatrix)

    expect(wrapper.find('.score-display').text()).toContain('12')
    expect(wrapper.find('.summary-bar').classes()).toContain('can')
    expect(wrapper.find('.feedback-action button').attributes('disabled')).toBeDefined()
  })

  it('updates a selection through the radio controls', async () => {
    const wrapper = mount(DecisionMatrix)
    const radios = wrapper.findAll('input[type="radio"]')
    await radios[1].setValue(true)
    expect(wrapper.find('.score-display').text()).toContain('10')
  })

  it('applies AI decisions and lets a case submit confirmations', async () => {
    client.post.mockResolvedValue({ data: { ok: true, lessons: [] } })
    const wrapper = mount(DecisionMatrix, {
      props: {
        aiDecisions: {
          caseId: 'case-123',
          decisions: [
            { dimension_id: 'risk', option_index: 2 }
          ]
        }
      }
    })

    expect(wrapper.find('.summary-bar').classes()).toContain('no')
    expect(wrapper.find('.feedback-action button').attributes('disabled')).toBeUndefined()

    await wrapper.find('.feedback-action button').trigger('click')
    await flushPromises()

    expect(client.post).toHaveBeenCalledOnce()
    expect(client.post).toHaveBeenCalledWith(
      '/agent/feedback',
      expect.objectContaining({
        caseId: 'case-123',
        confirmations: expect.arrayContaining([
          { dimension_id: 'risk', option_index: 2 }
        ])
      })
    )
    expect(wrapper.find('.feedback-success').exists()).toBe(true)
  })

  it('covers maybe/no scoring, lesson feedback and submission errors', async () => {
    const maybeDecisions = ['value', 'solution_type', 'tech_scope', 'environment'].map(dimension_id => ({ dimension_id, option_index: 1 }))
    client.post.mockResolvedValueOnce({ data: { ok: true, lessons: ['经验'] } })
    const wrapper = mount(DecisionMatrix, { props: { aiDecisions: { caseId: 'c2', decisions: maybeDecisions } } })
    expect(wrapper.find('.summary-bar').classes()).toContain('maybe')
    await wrapper.find('.feedback-action button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('1 条')

    await wrapper.setProps({ aiDecisions: { caseId: 'c2', decisions: [...maybeDecisions, { dimension_id: 'risk', option_index: 1 }] } })
    expect(wrapper.find('.summary-bar').classes()).toContain('no')

    vi.stubGlobal('alert', vi.fn())
    client.post.mockRejectedValueOnce({ response: { data: { detail: '提交异常' } } })
    await wrapper.find('.feedback-action button').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('提交异常')
  })
})
