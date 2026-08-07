import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import client from '../../api/client'
import StatsDashboard from '../StatsDashboard.vue'


vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn()
  }
}))


describe('StatsDashboard', () => {
  beforeEach(() => {
    client.get.mockReset()
  })

  it('loads and renders agent statistics on mount', async () => {
    client.get.mockResolvedValue({
      data: {
        totalCases: 12,
        confirmedCases: 8,
        lessonCount: 5,
        acceptanceRate: 75
      }
    })

    const wrapper = mount(StatsDashboard)
    await flushPromises()

    expect(client.get).toHaveBeenCalledWith('/agent/stats')
    expect(wrapper.findAll('.stat-num').map(node => node.text())).toEqual([
      '12',
      '8',
      '5',
      '75%'
    ])
  })

  it('keeps safe defaults when loading fails', async () => {
    client.get.mockRejectedValue(new Error('network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const wrapper = mount(StatsDashboard)
    await flushPromises()

    expect(wrapper.findAll('.stat-num').map(node => node.text())).toEqual([
      '0',
      '0',
      '0',
      '100%'
    ])
    expect(consoleSpy).toHaveBeenCalledOnce()
    consoleSpy.mockRestore()
  })
})

