import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFile } from 'node:child_process'

// Helper to parse multipart boundaries in Node.js without external dependencies
function parseMultipartNode(buffer: Buffer, boundary: string) {
  const boundaryBuffer = Buffer.from('--' + boundary)
  const parts: { filename: string; data: Buffer }[] = []
  
  let start = buffer.indexOf(boundaryBuffer)
  while (start !== -1) {
    const nextStart = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length)
    if (nextStart === -1) break
    
    const partBuffer = buffer.subarray(start + boundaryBuffer.length, nextStart)
    const headerEndIndex = partBuffer.indexOf('\r\n\r\n')
    if (headerEndIndex !== -1) {
      const headerText = partBuffer.subarray(0, headerEndIndex).toString('utf-8')
      const body = partBuffer.subarray(headerEndIndex + 4, partBuffer.length - 2) // strip trailing \r\n
      
      const filenameMatch = headerText.match(/filename=["']?([^"'\r\n]+)["']?/)
      if (filenameMatch) {
        parts.push({
          filename: filenameMatch[1],
          data: body,
        })
      }
    }
    start = nextStart
  }
  return parts
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'panorama-stitch-api',
      configureServer(server) {
        server.middlewares.use('/api/stitch', async (req, res, next) => {
          if (req.method !== 'POST') {
            return next()
          }

          const contentType = req.headers['content-type'] || ''
          const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
          if (!boundaryMatch) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ status: 'error', message: 'Missing boundary in multipart request' }))
            return
          }

          const boundary = boundaryMatch[1]
          const chunks: Buffer[] = []

          req.on('data', chunk => chunks.push(Buffer.from(chunk)))
          req.on('end', async () => {
            try {
              const fullBuffer = Buffer.concat(chunks)
              const files = parseMultipartNode(fullBuffer, boundary)

              if (files.length < 2) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ status: 'error', message: 'Необходимо прикрепить 2 кадра (по 180°)' }))
                return
              }

              const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stitch-'))
              const ext1 = path.extname(files[0].filename) || '.jpg'
              const ext2 = path.extname(files[1].filename) || '.jpg'
              const p1 = path.join(tmpDir, `frame1${ext1}`)
              const p2 = path.join(tmpDir, `frame2${ext2}`)
              const pOut = path.join(tmpDir, 'stitched_8k.jpg')

              fs.writeFileSync(p1, files[0].data)
              fs.writeFileSync(p2, files[1].data)

              const scriptPath = path.resolve(process.cwd(), 'stitch_panorama.py')

              execFile('python', [scriptPath, '--img1', p1, '--img2', p2, '--output', pOut], (err, _stdout, stderr) => {
                if (err || !fs.existsSync(pOut)) {
                  console.error('Stitch error:', err || stderr)
                  res.statusCode = 500
                  res.setHeader('Content-Type', 'application/json')
                  res.end(JSON.stringify({ status: 'error', message: stderr || err?.message || 'Ошибка сшивки панорамы' }))
                  return
                }

                const outBytes = fs.readFileSync(pOut)
                const b64 = outBytes.toString('base64')
                const dataUri = `data:image/jpeg;base64,${b64}`

                try {
                  fs.rmSync(tmpDir, { recursive: true, force: true })
                } catch {
                  // ignore
                }

                res.statusCode = 200
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.end(JSON.stringify({
                  status: 'ok',
                  image: dataUri,
                  size: outBytes.length,
                  width: 8192,
                }))
              })
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ status: 'error', message: err?.message || 'Server error' }))
            }
          })
        })
      },
    },
  ],
})
