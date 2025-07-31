import { ref, computed } from 'vue'

export interface ModalState {
  visible: boolean
  loading: boolean
  title: string
  data: any
}

export interface UseModalOptions {
  defaultTitle?: string
  onOpen?: (data?: any) => void | Promise<void>
  onClose?: () => void | Promise<void>
  onConfirm?: (data?: any) => void | Promise<void>
  onCancel?: () => void | Promise<void>
}

export function useModal(options: UseModalOptions = {}) {
  const state = ref<ModalState>({
    visible: false,
    loading: false,
    title: options.defaultTitle || '',
    data: null
  })

  const isVisible = computed({
    get: () => state.value.visible,
    set: (value: boolean) => {
      state.value.visible = value
    }
  })

  const isLoading = computed({
    get: () => state.value.loading,
    set: (value: boolean) => {
      state.value.loading = value
    }
  })

  const title = computed({
    get: () => state.value.title,
    set: (value: string) => {
      state.value.title = value
    }
  })

  const data = computed({
    get: () => state.value.data,
    set: (value: any) => {
      state.value.data = value
    }
  })

  const open = async (modalData?: any, modalTitle?: string) => {
    try {
      state.value.data = modalData || null
      state.value.title = modalTitle || options.defaultTitle || ''
      state.value.visible = true
      
      if (options.onOpen) {
        await options.onOpen(modalData)
      }
    } catch (error) {
      console.error('Modal open error:', error)
      state.value.visible = false
    }
  }

  const close = async () => {
    try {
      if (options.onClose) {
        await options.onClose()
      }
      
      state.value.visible = false
      state.value.loading = false
      state.value.data = null
    } catch (error) {
      console.error('Modal close error:', error)
    }
  }

  const confirm = async () => {
    try {
      state.value.loading = true
      
      if (options.onConfirm) {
        await options.onConfirm(state.value.data)
      }
      
      await close()
    } catch (error) {
      console.error('Modal confirm error:', error)
      state.value.loading = false
      throw error
    }
  }

  const cancel = async () => {
    try {
      if (options.onCancel) {
        await options.onCancel()
      }
      
      await close()
    } catch (error) {
      console.error('Modal cancel error:', error)
    }
  }

  const setLoading = (loading: boolean) => {
    state.value.loading = loading
  }

  const setTitle = (newTitle: string) => {
    state.value.title = newTitle
  }

  const setData = (newData: any) => {
    state.value.data = newData
  }

  const reset = () => {
    state.value = {
      visible: false,
      loading: false,
      title: options.defaultTitle || '',
      data: null
    }
  }

  return {
    // 状态
    state: readonly(state),
    isVisible,
    isLoading,
    title,
    data,
    
    // 方法
    open,
    close,
    confirm,
    cancel,
    setLoading,
    setTitle,
    setData,
    reset
  }
}

// 多模态框管理
export function useModalManager() {
  const modals = ref<Map<string, ReturnType<typeof useModal>>>(new Map())

  const createModal = (key: string, options?: UseModalOptions) => {
    const modal = useModal(options)
    modals.value.set(key, modal)
    return modal
  }

  const getModal = (key: string) => {
    return modals.value.get(key)
  }

  const removeModal = (key: string) => {
    const modal = modals.value.get(key)
    if (modal) {
      modal.close()
      modals.value.delete(key)
    }
  }

  const closeAll = async () => {
    const promises = Array.from(modals.value.values()).map(modal => modal.close())
    await Promise.all(promises)
  }

  const resetAll = () => {
    modals.value.forEach(modal => modal.reset())
  }

  return {
    modals: readonly(modals),
    createModal,
    getModal,
    removeModal,
    closeAll,
    resetAll
  }
}

export default useModal
