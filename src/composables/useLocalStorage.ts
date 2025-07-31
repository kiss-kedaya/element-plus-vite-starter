import { ref, watch, Ref } from 'vue'

export interface UseLocalStorageOptions<T> {
  defaultValue?: T
  serializer?: {
    read: (value: string) => T
    write: (value: T) => string
  }
  onError?: (error: Error) => void
}

export function useLocalStorage<T>(
  key: string,
  defaultValue?: T,
  options: UseLocalStorageOptions<T> = {}
): [Ref<T>, (value: T) => void, () => void] {
  const {
    serializer = {
      read: JSON.parse,
      write: JSON.stringify
    },
    onError = (error) => console.error('LocalStorage error:', error)
  } = options

  const storedValue = ref<T>(defaultValue as T)

  // 读取初始值
  const read = () => {
    try {
      const item = localStorage.getItem(key)
      if (item !== null) {
        storedValue.value = serializer.read(item)
      } else if (defaultValue !== undefined) {
        storedValue.value = defaultValue
      }
    } catch (error) {
      onError(error as Error)
      if (defaultValue !== undefined) {
        storedValue.value = defaultValue
      }
    }
  }

  // 写入值
  const write = (value: T) => {
    try {
      storedValue.value = value
      if (value === null || value === undefined) {
        localStorage.removeItem(key)
      } else {
        localStorage.setItem(key, serializer.write(value))
      }
    } catch (error) {
      onError(error as Error)
    }
  }

  // 删除值
  const remove = () => {
    try {
      localStorage.removeItem(key)
      storedValue.value = defaultValue as T
    } catch (error) {
      onError(error as Error)
    }
  }

  // 监听值变化
  watch(
    storedValue,
    (newValue) => {
      write(newValue)
    },
    { deep: true }
  )

  // 监听其他标签页的变化
  window.addEventListener('storage', (e) => {
    if (e.key === key && e.newValue !== null) {
      try {
        storedValue.value = serializer.read(e.newValue)
      } catch (error) {
        onError(error as Error)
      }
    }
  })

  // 初始化
  read()

  return [storedValue, write, remove]
}

// 预定义的常用存储
export function useUserSettings() {
  return useLocalStorage('user-settings', {
    theme: 'light',
    language: 'zh-CN',
    autoLogin: false,
    notifications: true
  })
}

export function useRecentContacts() {
  return useLocalStorage<string[]>('recent-contacts', [])
}

export function useChatDrafts() {
  return useLocalStorage<Record<string, string>>('chat-drafts', {})
}

export function useAppConfig() {
  return useLocalStorage('app-config', {
    apiBaseUrl: 'http://localhost:8059/api',
    wsUrl: 'ws://localhost:8088/ws',
    timeout: 10000,
    retryCount: 3
  })
}

// 会话存储（页面关闭后清除）
export function useSessionStorage<T>(
  key: string,
  defaultValue?: T,
  options: UseLocalStorageOptions<T> = {}
): [Ref<T>, (value: T) => void, () => void] {
  const {
    serializer = {
      read: JSON.parse,
      write: JSON.stringify
    },
    onError = (error) => console.error('SessionStorage error:', error)
  } = options

  const storedValue = ref<T>(defaultValue as T)

  const read = () => {
    try {
      const item = sessionStorage.getItem(key)
      if (item !== null) {
        storedValue.value = serializer.read(item)
      } else if (defaultValue !== undefined) {
        storedValue.value = defaultValue
      }
    } catch (error) {
      onError(error as Error)
      if (defaultValue !== undefined) {
        storedValue.value = defaultValue
      }
    }
  }

  const write = (value: T) => {
    try {
      storedValue.value = value
      if (value === null || value === undefined) {
        sessionStorage.removeItem(key)
      } else {
        sessionStorage.setItem(key, serializer.write(value))
      }
    } catch (error) {
      onError(error as Error)
    }
  }

  const remove = () => {
    try {
      sessionStorage.removeItem(key)
      storedValue.value = defaultValue as T
    } catch (error) {
      onError(error as Error)
    }
  }

  watch(
    storedValue,
    (newValue) => {
      write(newValue)
    },
    { deep: true }
  )

  read()

  return [storedValue, write, remove]
}

// 临时数据存储
export function useTempData() {
  return useSessionStorage('temp-data', {})
}

export function useFormDrafts() {
  return useSessionStorage<Record<string, any>>('form-drafts', {})
}

export default useLocalStorage
