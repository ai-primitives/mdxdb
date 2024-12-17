export interface DeploymentResponse {
  success: boolean
  result?: {
    id: string
    etag: string
  }
  errors?: string[]
}
