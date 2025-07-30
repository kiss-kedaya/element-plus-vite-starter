export * from './auth'
export * from './chat'
export * from './friend'

export interface ApiResponse<T = any> {
  Code: number
  Success: boolean
  Message: string
  Data?: T
  Data62?: string
  Debug?: string
}
