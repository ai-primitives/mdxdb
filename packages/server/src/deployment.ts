import { Hono } from 'hono'
import { z } from 'zod'

export interface DeploymentOptions {
  accountId: string
  namespace: string
  name: string
  token: string
}

export interface DeploymentResult {
  success: boolean
  errors?: string[]
  result?: {
    id: string
    etag: string
  }
}

interface CloudflareAPIResponse {
  success: boolean
  errors?: Array<{
    code: number
    message: string
  }>
  result?: {
    id: string
    etag: string
  }
}

const deploymentSchema = z.object({
  accountId: z.string(),
  namespace: z.string(),
  name: z.string(),
  script: z.string(),
  token: z.string().optional()
})

export const deployToCloudflare = async (script: string, options: DeploymentOptions): Promise<DeploymentResult> => {
  const form = new FormData()
  form.append('metadata', JSON.stringify({
    body_part: 'script',
    bindings: []
  }))
  form.append('script', script)

  try {
    const response = await (globalThis.fetch as typeof fetch)(
      `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/workers/dispatch/namespaces/${options.namespace}/scripts/${options.name}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${options.token}`
        },
        body: form
      }
    )

    const result = await response.json() as CloudflareAPIResponse

    if (!response.ok) {
      return {
        success: false,
        errors: [result.errors?.[0]?.message || 'Unknown error occurred']
      }
    }

    return {
      success: true,
      result: result.result
    }
  } catch (error) {
    return {
      success: false,
      errors: [(error as Error).message]
    }
  }
}

export const createDeploymentRouter = () => {
  const app = new Hono()

  app.post('/deploy', async (c) => {
    const body = await c.req.json()
    const result = deploymentSchema.safeParse(body)

    if (!result.success) {
      return c.json({ success: false, errors: result.error.errors.map(e => e.message) }, 400)
    }

    const { accountId, namespace, name, script, token } = result.data
    const deploymentResult = await deployToCloudflare(script, {
      accountId,
      namespace,
      name,
      token: token || process.env.CLOUDFLARE_API_TOKEN || ''
    })

    if (!deploymentResult.success) {
      return c.json(deploymentResult, 400)
    }

    return c.json(deploymentResult)
  })

  return app
}
