const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export const apiUrl = (path) => {
  if (!path) return API_BASE_URL || ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path
}

export const apiFetch = (path, options = {}) => {
  return fetch(apiUrl(path), options)
}
