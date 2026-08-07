import { describe, expect, it, vi } from 'vitest'

const mount = vi.fn()
const createApp = vi.fn(() => ({ mount }))

vi.mock('vue', () => ({ createApp }))
vi.mock('../../App.vue', () => ({ default: {} }))


describe('main entry', () => {
  it('creates and mounts the Vue application', async () => {
    await import('../../main.js')
    expect(createApp).toHaveBeenCalledOnce()
    expect(mount).toHaveBeenCalledWith('#app')
  })
})

