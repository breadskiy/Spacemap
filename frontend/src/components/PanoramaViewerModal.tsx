import { useEffect, useRef, useState } from 'react'
import type { PlanPanorama } from '../types/plan'

interface PanoramaViewerModalProps {
  panorama: PlanPanorama
  roomName?: string
  floorName?: string
  onClose: () => void
}

export function PanoramaViewerModal({
  panorama,
  roomName = 'Комната',
  floorName = '1 этаж',
  onClose
}: PanoramaViewerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isAutoRotate, setIsAutoRotate] = useState(true)
  const [fov, setFov] = useState(75)

  const stateRef = useRef({
    yaw: 0,
    pitch: 0,
    fov: 75,
    autoRotate: true,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    textureImg: null as HTMLImageElement | null,
    animId: null as number | null
  })

  stateRef.current.autoRotate = isAutoRotate
  stateRef.current.fov = fov

  // Генерация красивой градиентной 360-текстуры если фото не загружено
  const generatePlaceholderTexture = (title: string): string => {
    const c = document.createElement('canvas')
    c.width = 2048
    c.height = 1024
    const ctx = c.getContext('2d')
    if (!ctx) return ''

    // Потолок и небо
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 512)
    skyGrad.addColorStop(0, '#0f172a')
    skyGrad.addColorStop(1, '#1e293b')
    ctx.fillStyle = skyGrad
    ctx.fillRect(0, 0, 2048, 512)

    // Пол
    const floorGrad = ctx.createLinearGradient(0, 512, 0, 1024)
    floorGrad.addColorStop(0, '#334155')
    floorGrad.addColorStop(1, '#0f172a')
    ctx.fillStyle = floorGrad
    ctx.fillRect(0, 512, 2048, 512)

    // Линия горизонта и сетка помещения
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.35)'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(0, 512)
    ctx.lineTo(2048, 512)
    ctx.stroke()

    // Архитектурные колонны по кругу (каждые 90 градусов)
    for (let x = 0; x < 2048; x += 512) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x, 150)
      ctx.lineTo(x, 874)
      ctx.stroke()

      ctx.fillStyle = 'rgba(99, 102, 241, 0.8)'
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`360° Обзор: ${title}`, x + 256, 480)

      ctx.font = '24px sans-serif'
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.fillText(`Сектор ${Math.round((x / 2048) * 360)}°`, x + 256, 540)
    }

    return c.toDataURL('image/jpeg', 0.85)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.parentElement?.clientWidth || window.innerWidth
      const h = canvas.parentElement?.clientHeight || window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    // Загрузка панорамной текстуры (поддержка image_data и image с надёжным фолбэком)
    const rawSrc = panorama.image_data || panorama.image
    const imgSrc = rawSrc && rawSrc.trim() ? rawSrc.trim() : generatePlaceholderTexture(panorama.name || roomName)
    const img = new Image()
    if (!imgSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }

    const loadFallback = () => {
      const fallbackSrc = generatePlaceholderTexture(panorama.name || roomName)
      const fallbackImg = new Image()
      fallbackImg.onload = () => {
        stateRef.current.textureImg = fallbackImg
        startRender()
      }
      fallbackImg.src = fallbackSrc
    }

    img.onload = () => {
      stateRef.current.textureImg = img
      startRender()
    }
    img.onerror = () => {
      console.warn('Could not load panorama image, falling back to 360 procedural texture')
      loadFallback()
    }
    img.src = imgSrc

    const startRender = () => {
      const render = () => {
        const state = stateRef.current
        const texture = state.textureImg
        if (!texture) return

        if (state.autoRotate && !state.isDragging) {
          state.yaw = (state.yaw + 0.18) % 360
        }

        const vw = canvas.width
        const vh = canvas.height
        ctx.clearRect(0, 0, vw, vh)

        // Цилиндрическая проекция на основе yaw / pitch / fov
        const visibleRatio = state.fov / 360
        const srcVisibleWidth = texture.width * visibleRatio
        const srcCenterX = (state.yaw / 360) * texture.width
        const srcX1 = srcCenterX - srcVisibleWidth / 2
        const pitchOffset = (state.pitch / 90) * (vh * 0.85)

        if (srcX1 < 0) {
          const leftPartWidth = -srcX1
          const leftRatio = leftPartWidth / srcVisibleWidth
          const destSplitX = vw * leftRatio

          ctx.drawImage(
            texture,
            texture.width - leftPartWidth, 0, leftPartWidth, texture.height,
            0, pitchOffset, destSplitX, vh
          )
          ctx.drawImage(
            texture,
            0, 0, srcVisibleWidth - leftPartWidth, texture.height,
            destSplitX, pitchOffset, vw - destSplitX, vh
          )
        } else if (srcX1 + srcVisibleWidth > texture.width) {
          const rightPartWidth = texture.width - srcX1
          const rightRatio = rightPartWidth / srcVisibleWidth
          const destSplitX = vw * rightRatio

          ctx.drawImage(
            texture,
            srcX1, 0, rightPartWidth, texture.height,
            0, pitchOffset, destSplitX, vh
          )
          ctx.drawImage(
            texture,
            0, 0, srcVisibleWidth - rightPartWidth, texture.height,
            destSplitX, pitchOffset, vw - destSplitX, vh
          )
        } else {
          ctx.drawImage(
            texture,
            srcX1, 0, srcVisibleWidth, texture.height,
            0, pitchOffset, vw, vh
          )
        }

        state.animId = requestAnimationFrame(render)
      }

      stateRef.current.animId = requestAnimationFrame(render)
    }

    // Обработчики мыши и тача
    const onMouseDown = (e: MouseEvent) => {
      stateRef.current.isDragging = true
      stateRef.current.lastX = e.clientX
      stateRef.current.lastY = e.clientY
      setIsAutoRotate(false)
    }

    const onMouseMove = (e: MouseEvent) => {
      const state = stateRef.current
      if (!state.isDragging) return
      const dx = e.clientX - state.lastX
      const dy = e.clientY - state.lastY
      const sensitivity = 0.25
      state.yaw = (state.yaw - dx * sensitivity + 360) % 360
      state.pitch = Math.max(-42, Math.min(42, state.pitch + dy * sensitivity))
      state.lastX = e.clientX
      state.lastY = e.clientY
    }

    const onMouseUp = () => {
      stateRef.current.isDragging = false
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY * 0.05
      setFov(prev => Math.max(40, Math.min(95, prev + delta)))
    }

    // Touch
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        stateRef.current.isDragging = true
        stateRef.current.lastX = e.touches[0].clientX
        stateRef.current.lastY = e.touches[0].clientY
        setIsAutoRotate(false)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      const state = stateRef.current
      if (state.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - state.lastX
        const dy = e.touches[0].clientY - state.lastY
        const sensitivity = 0.25
        state.yaw = (state.yaw - dx * sensitivity + 360) % 360
        state.pitch = Math.max(-42, Math.min(42, state.pitch + dy * sensitivity))
        state.lastX = e.touches[0].clientX
        state.lastY = e.touches[0].clientY
      }
    }

    const onTouchEnd = () => {
      stateRef.current.isDragging = false
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      window.removeEventListener('resize', handleResize)
      canvas.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      if (stateRef.current.animId) cancelAnimationFrame(stateRef.current.animId)
    }
  }, [panorama, roomName])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl h-[88vh] rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Шапка 360° вьювера */}
        <header className="px-5 py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {panorama.name || 'Панорама 360°'}
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                  {roomName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {floorName} · Координаты: <span className="font-mono text-indigo-300">X: {panorama.x}, Y: {panorama.y}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Кнопка авто-вращения */}
            <button
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border ${
                isAutoRotate
                  ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/50 hover:bg-indigo-600/50'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <span>{isAutoRotate ? 'Пауза' : 'Авто-вращение'}</span>
            </button>

            {/* Закрыть */}
            <button
              onClick={onClose}
              className="size-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition border border-slate-700"
              title="Закрыть 360° просмотр"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Холст панорамы */}
        <div className="flex-1 relative overflow-hidden bg-black select-none cursor-grab active:cursor-grabbing">
          <canvas ref={canvasRef} className="w-full h-full block" />

          {/* Кнопки зума в правом нижнем углу */}
          <div className="absolute bottom-5 right-5 flex flex-col gap-2 z-10">
            <button
              onClick={() => setFov(prev => Math.max(40, prev - 8))}
              className="size-9 bg-slate-800/85 hover:bg-slate-700 border border-slate-700 text-white rounded-xl flex items-center justify-center transition shadow-lg backdrop-blur"
              title="Приблизить"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setFov(prev => Math.min(95, prev + 8))}
              className="size-9 bg-slate-800/85 hover:bg-slate-700 border border-slate-700 text-white rounded-xl flex items-center justify-center transition shadow-lg backdrop-blur"
              title="Отдалить"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
              </svg>
            </button>
          </div>

          {/* Подсказка внизу */}
          <div className="absolute bottom-5 left-5 bg-slate-900/85 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-700 text-[11px] text-slate-300 pointer-events-none flex items-center gap-2 shadow">
            <svg className="size-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <span>Зажмите левую кнопку мыши и вращайте обзор 360° | Колесико — зум</span>
          </div>
        </div>
      </div>
    </div>
  )
}
