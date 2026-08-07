import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import client from '../../api/client'
import AdminModal from '../AdminModal.vue'


vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}))


const buttonByText = (wrapper, text) => wrapper.findAll('button').find(button => button.text().includes(text))


describe('AdminModal', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.stubGlobal('alert', vi.fn())
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  it('logs in, loads lessons, and emits close', async () => {
    client.post.mockResolvedValue({ data: { ok: true, token: 'token', config: { endpoint: 'e', apiKey: 'k', model: 'm' } } })
    client.get.mockResolvedValue({ data: { ok: true, lessons: [] } })
    const wrapper = mount(AdminModal, { props: { show: true } })

    await wrapper.find('input[type="password"]').setValue('secret')
    await buttonByText(wrapper, '登录管理员').trigger('click')
    await flushPromises()

    expect(localStorage.getItem('kuntai_admin_token')).toBe('token')
    expect(client.post).toHaveBeenCalledWith('/admin/login', { password: 'secret' })
    expect(wrapper.find('.admin-panel').exists()).toBe(true)
    expect(client.get).toHaveBeenCalledWith('/admin/lessons')

    await wrapper.find('.modal-close').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows rejected login and network login errors', async () => {
    client.post
      .mockResolvedValueOnce({ data: { ok: false, message: '密码错误' } })
      .mockRejectedValueOnce({ response: { data: { detail: '服务失败' } } })
    const wrapper = mount(AdminModal, { props: { show: true } })
    await buttonByText(wrapper, '登录管理员').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('密码错误')
    await buttonByText(wrapper, '登录管理员').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('服务失败')
  })

  it('loads config and performs lesson/config CRUD', async () => {
    localStorage.setItem('kuntai_admin_token', 'token')
    client.get.mockImplementation(url => Promise.resolve(url === '/config'
      ? { data: { endpoint: 'https://api', model: 'model' } }
      : { data: { ok: true, lessons: [{ id: 'l1', lesson: '经验', context: '来源', dimensionId: 'risk' }] } }))
    client.post.mockImplementation(url => Promise.resolve(url === '/config'
      ? { data: { ok: true } }
      : { data: { ok: true } }))
    client.put.mockResolvedValue({ data: { ok: true } })
    client.delete.mockResolvedValue({ data: { ok: true } })

    const wrapper = mount(AdminModal, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(client.get).toHaveBeenCalledWith('/config')

    await buttonByText(wrapper, 'AI 服务参数配置').trigger('click')
    await buttonByText(wrapper, '保存 AI').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('更新成功')

    await buttonByText(wrapper, '沉淀经验').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('经验')

    const addInput = wrapper.find('input[placeholder*="录入新的"]')
    await buttonByText(wrapper, '添加规则').trigger('click')
    expect(alert).toHaveBeenCalledWith('规则内容不能为空')
    await addInput.setValue('新经验')
    await buttonByText(wrapper, '添加规则').trigger('click')
    await flushPromises()
    expect(client.post).toHaveBeenCalledWith('/admin/lessons', expect.objectContaining({ lesson: '新经验' }))

    await buttonByText(wrapper, '编辑').trigger('click')
    await wrapper.find('textarea').setValue('修改经验')
    await buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(client.put).toHaveBeenCalledWith('/admin/lessons/l1', { lesson: '修改经验' })

    await buttonByText(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(client.delete).toHaveBeenCalledWith('/admin/lessons/l1')
  })

  it('handles unauthorized config access', async () => {
    localStorage.setItem('kuntai_admin_token', 'token')
    client.get.mockRejectedValue({ response: { status: 401 } })
    const wrapper = mount(AdminModal, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()
    expect(localStorage.getItem('kuntai_admin_token')).toBeNull()
    expect(wrapper.find('.login-view').exists()).toBe(true)
  })

  it('handles CRUD failures and cancelled deletion', async () => {
    localStorage.setItem('kuntai_admin_token', 'token')
    const lessonResponse = { data: { ok: true, lessons: [{ id: 'l1', lesson: '经验', dimensionId: 'risk' }] } }
    client.get.mockResolvedValue(lessonResponse)
    const wrapper = mount(AdminModal, { props: { show: false } })
    await wrapper.setProps({ show: true })
    await flushPromises()

    await buttonByText(wrapper, 'AI 服务参数配置').trigger('click')
    client.post.mockRejectedValueOnce({ response: { data: { detail: '保存异常' } } })
    await buttonByText(wrapper, '保存 AI').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('保存异常')

    await buttonByText(wrapper, '沉淀经验').trigger('click')
    await flushPromises()
    await wrapper.find('input[placeholder*="录入新的"]').setValue('新经验')
    client.post.mockRejectedValueOnce({ response: { data: { detail: '添加异常' } } })
    await buttonByText(wrapper, '添加规则').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('添加异常')

    await buttonByText(wrapper, '编辑').trigger('click')
    await buttonByText(wrapper, '取消').trigger('click')
    await buttonByText(wrapper, '编辑').trigger('click')
    client.put.mockRejectedValueOnce({ response: { status: 500 } })
    await buttonByText(wrapper, '保存').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('保存修改失败')

    confirm.mockReturnValueOnce(false)
    await buttonByText(wrapper, '删除').trigger('click')
    expect(client.delete).not.toHaveBeenCalled()

    confirm.mockReturnValueOnce(true)
    client.delete.mockRejectedValueOnce({ response: { status: 500 } })
    await buttonByText(wrapper, '删除').trigger('click')
    await flushPromises()
    expect(alert).toHaveBeenCalledWith('删除失败')
  })
})
