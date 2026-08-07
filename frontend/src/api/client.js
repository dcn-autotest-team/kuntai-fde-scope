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

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('kuntai_admin_token')
    }
    return Promise.reject(error)
  }
)

export default client
