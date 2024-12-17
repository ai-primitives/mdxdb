/// <reference types="@cloudflare/workers-types" />

// Declare any additional globals not covered by @cloudflare/workers-types
declare global {
  // Add any custom global types here that aren't in @cloudflare/workers-types
  const global: typeof globalThis
}

export {}
