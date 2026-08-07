import { beforeEach, describe, expect, it } from 'vitest'

import client from '../../api/client'


describe('API client interceptors', () => {
  beforeEach(() => localStorage.clear())

  it('adds the admin token when present', () => {
    localStorage.setItem('kuntai_admin_token', 'token')
    const handler = client.interceptors.request.handlers[0].fulfilled
    const config = handler({ headers: {} })
    expect(config.headers['x-admin-token']).toBe('token')
  })

  it('leaves anonymous requests unchanged', () => {
    const handler = client.interceptors.request.handlers[0].fulfilled
    expect(handler({ headers: {} }).headers['x-admin-token']).toBeUndefined()
  })

  it('returns responses and clears tokens after a 401', async () => {
    const handler = client.interceptors.response.handlers[0]
    expect(handler.fulfilled({ data: 1 })).toEqual({ data: 1 })

    localStorage.setItem('kuntai_admin_token', 'token')
    await expect(handler.rejected({ response: { status: 401 } })).rejects.toEqual({ response: { status: 401 } })
    expect(localStorage.getItem('kuntai_admin_token')).toBeNull()
    await expect(handler.rejected(new Error('network'))).rejects.toThrow('network')
  })
})

