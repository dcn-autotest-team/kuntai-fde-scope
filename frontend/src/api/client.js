import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('kuntai_admin_token')
  if (token) {
    config.headers['x-admin-token'] = token
  }
  return config
})

export default client
