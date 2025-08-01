import { ref, unref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'

// 临时类型定义，应该从实际的request文件中导入
interface ApiResponse<T = any> {
  code: number
  success: boolean
  message: string
  data: T
}

// API调用状态
export interface ApiState<T = any> {
  data: Ref<T | null>
  loading: Ref<boolean>
  error: Ref<string | null>
  success: Ref<boolean>
}

// API调用选项
export interface ApiOptions {
  immediate?: boolean          // 是否立即执行
  showError?: boolean         // 是否显示错误消息
  showSuccess?: boolean       // 是否显示成功消息
  successMessage?: string     // 成功消息内容
  errorMessage?: string       // 错误消息内容
  onSuccess?: (data: any) => void    // 成功回调
  onError?: (error: Error) => void   // 错误回调
  transform?: (data: any) => any     // 数据转换函数
}

// 通用API调用Hook
export function useApi<T = any>(
  apiFunction: (...args: any[]) => Promise<ApiResponse<T>>,
  options: ApiOptions = {}
) {
  const {
    immediate = false,
    showError = true,
    showSuccess = false,
    successMessage,
    errorMessage,
    onSuccess,
    onError,
    transform
  } = options

  // 状态管理
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const success = ref(false)

  // 执行API调用
  const execute = async (...args: any[]) => {
    try {
      loading.value = true
      error.value = null
      success.value = false

      const response = await apiFunction(...args)
      
      // 数据转换
      const transformedData = transform ? transform(response.data) : response.data
      data.value = transformedData

      success.value = true

      // 成功回调
      if (onSuccess) {
        onSuccess(transformedData)
      }

      // 显示成功消息
      if (showSuccess && successMessage) {
        ElMessage.success(successMessage)
      }

      return transformedData
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '请求失败'
      error.value = errorMsg

      // 错误回调
      if (onError) {
        onError(err as Error)
      }

      // 显示错误消息
      if (showError) {
        ElMessage.error(errorMessage || errorMsg)
      }

      throw err
    } finally {
      loading.value = false
    }
  }

  // 重置状态
  const reset = () => {
    data.value = null
    loading.value = false
    error.value = null
    success.value = false
  }

  // 立即执行
  if (immediate) {
    execute()
  }

  return {
    data,
    loading,
    error,
    success,
    execute,
    reset
  }
}

// 分页API调用Hook
export interface PaginationState {
  page: Ref<number>
  pageSize: Ref<number>
  total: Ref<number>
  totalPages: Ref<number>
}

export interface PaginationOptions extends ApiOptions {
  defaultPage?: number
  defaultPageSize?: number
}

export function usePaginationApi<T = any>(
  apiFunction: (params: any) => Promise<ApiResponse<{ list: T[], total: number }>>,
  options: PaginationOptions = {}
) {
  const {
    defaultPage = 1,
    defaultPageSize = 20,
    ...apiOptions
  } = options

  // 分页状态
  const page = ref(defaultPage)
  const pageSize = ref(defaultPageSize)
  const total = ref(0)
  const totalPages = ref(0)

  // API状态
  const { data, loading, error, success, execute: baseExecute, reset } = useApi(
    apiFunction,
    {
      ...apiOptions,
      transform: (response) => {
        total.value = response.total || 0
        totalPages.value = Math.ceil(total.value / pageSize.value)
        return response.list || []
      }
    }
  )

  // 执行查询
  const execute = async (params: any = {}) => {
    return await baseExecute({
      page: unref(page),
      page_size: unref(pageSize),
      ...params
    })
  }

  // 刷新当前页
  const refresh = () => execute()

  // 跳转到指定页
  const goToPage = (targetPage: number) => {
    page.value = targetPage
    execute()
  }

  // 改变页面大小
  const changePageSize = (newPageSize: number) => {
    pageSize.value = newPageSize
    page.value = 1
    execute()
  }

  // 上一页
  const prevPage = () => {
    if (page.value > 1) {
      goToPage(page.value - 1)
    }
  }

  // 下一页
  const nextPage = () => {
    if (page.value < totalPages.value) {
      goToPage(page.value + 1)
    }
  }

  return {
    // 数据状态
    data,
    loading,
    error,
    success,
    
    // 分页状态
    page,
    pageSize,
    total,
    totalPages,
    
    // 方法
    execute,
    refresh,
    reset,
    goToPage,
    changePageSize,
    prevPage,
    nextPage
  }
}

// 表单提交Hook
export interface FormApiOptions extends ApiOptions {
  resetOnSuccess?: boolean    // 成功后是否重置表单
  validateBeforeSubmit?: () => boolean | Promise<boolean>  // 提交前验证
}

export function useFormApi<T = any>(
  apiFunction: (data: any) => Promise<ApiResponse<T>>,
  options: FormApiOptions = {}
) {
  const {
    resetOnSuccess = false,
    validateBeforeSubmit,
    ...apiOptions
  } = options

  const { data, loading, error, success, execute: baseExecute, reset } = useApi(
    apiFunction,
    apiOptions
  )

  // 提交表单
  const submit = async (formData: any) => {
    try {
      // 提交前验证
      if (validateBeforeSubmit) {
        const isValid = await validateBeforeSubmit()
        if (!isValid) {
          return
        }
      }

      const result = await baseExecute(formData)

      // 成功后重置
      if (resetOnSuccess) {
        reset()
      }

      return result
    } catch (err) {
      throw err
    }
  }

  return {
    data,
    loading,
    error,
    success,
    submit,
    reset
  }
}

// 文件上传Hook
export interface UploadOptions extends ApiOptions {
  accept?: string             // 接受的文件类型
  maxSize?: number           // 最大文件大小(MB)
  multiple?: boolean         // 是否支持多文件
}

export function useUploadApi(
  apiFunction: (file: File | File[]) => Promise<ApiResponse<any>>,
  options: UploadOptions = {}
) {
  const {
    accept,
    maxSize,
    multiple = false,
    ...apiOptions
  } = options

  const { data, loading, error, success, execute: baseExecute, reset } = useApi(
    apiFunction,
    apiOptions
  )

  // 文件验证
  const validateFile = (file: File): boolean => {
    // 文件类型验证
    if (accept && !accept.split(',').some(type => file.type.includes(type.trim()))) {
      ElMessage.error('文件类型不支持')
      return false
    }

    // 文件大小验证
    if (maxSize && file.size > maxSize * 1024 * 1024) {
      ElMessage.error(`文件大小不能超过${maxSize}MB`)
      return false
    }

    return true
  }

  // 上传文件
  const upload = async (files: File | File[]) => {
    const fileList = Array.isArray(files) ? files : [files]

    // 验证文件
    for (const file of fileList) {
      if (!validateFile(file)) {
        return
      }
    }

    // 执行上传
    return await baseExecute(multiple ? fileList : fileList[0])
  }

  return {
    data,
    loading,
    error,
    success,
    upload,
    reset
  }
}

// 导出所有Hook
export default {
  useApi,
  usePaginationApi,
  useFormApi,
  useUploadApi
}
