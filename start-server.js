#!/usr/bin/env node

// حل مباشر لتشغيل الخادم
import { createServer } from 'vite'

async function startServer() {
  try {
    const server = await createServer({
      server: {
        host: '::',
        port: 8080,
        cors: true
      }
    })
    
    await server.listen()
    server.printUrls()
    console.log('✅ تم تشغيل الخادم بنجاح!')
  } catch (error) {
    console.error('❌ خطأ:', error)
    process.exit(1)
  }
}

startServer()