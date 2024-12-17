/// <reference types="@cloudflare/workers-types" />

// Declare any additional globals not covered by @cloudflare/workers-types
declare global {
  const process: {
    env: Record<string, string | undefined>
    versions: {
      node: string
      [key: string]: string | undefined
    }
    platform: string
    arch: string
  }
  const FormData: typeof globalThis.FormData
}

export {}
