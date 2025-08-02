#!/usr/bin/env node

// Direct vite starter script as workaround
import { createServer } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function startDevServer() {
  try {
    // Import the vite config
    const configModule = await import('./vite.config.js')
    const viteConfig = typeof configModule.default === 'function' 
      ? await configModule.default({ mode: 'development' })
      : configModule.default

    // Create and start the dev server
    const server = await createServer({
      ...viteConfig,
      root: __dirname,
      mode: 'development'
    })
    
    await server.listen()
    server.printUrls()
    
    console.log('\n✅ Development server started successfully!')
  } catch (error) {
    console.error('❌ Error starting dev server:', error)
    process.exit(1)
  }
}

startDevServer()