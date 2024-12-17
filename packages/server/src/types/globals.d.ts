/// <reference types="@cloudflare/workers-types" />

// Declare any additional globals not covered by @cloudflare/workers-types
declare global {
  const process: {
    env: Record<string, string | undefined>
  }
  const FormData: typeof globalThis.FormData
}

export {}
