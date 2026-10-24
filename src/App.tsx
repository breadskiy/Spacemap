import { useState, useEffect } from 'react'
import type { SpaceObject } from './types/space'
import { getSpaces } from './utils/storage'
import { Navbar } from './components/Navbar'
import { LandingView } from './components/LandingView'
import { DashboardView } from './components/DashboardView'
import { EditorView } from './components/EditorView'
import { CreateSpaceModal } from './components/CreateSpaceModal'
import { QRCodeModal } from './components/QRCodeModal'

export default function App() {
  const [currentTab, setCurrentTab] = useState<'landing' | 'dashboard' | 'editor'>('landing')
  const [spaces, setSpaces] = useState<SpaceObject[]>([])
  const [selectedSpace, setSelectedSpace] = useState<SpaceObject | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [qrModalData, setQrModalData] = useState<{ isOpen: boolean; title: string; url: string }>({
    isOpen: false,
    title: '',
    url: ''
  })

  const loadSpaces = () => {
    const list = getSpaces()
    setSpaces(list)
  }

  useEffect(() => {
    loadSpaces()
  }, [])

  const handleOpenEditor = (space: SpaceObject) => {
    setSelectedSpace(space)
    setCurrentTab('editor')
  }

  const handleCreated = (newSpace: SpaceObject) => {
    loadSpaces()
    setIsCreateOpen(false)
    // Сразу открываем редактор созданного объекта
    setSelectedSpace(newSpace)
    setCurrentTab('editor')
  }

  const handleUpdateSpace = (updated: SpaceObject) => {
    loadSpaces()
    setSelectedSpace(updated)
  }

  const handleOpenQR = (space: SpaceObject) => {
    setQrModalData({
      isOpen: true,
      title: space.title,
      url: space.publicUrl || `https://spacemap.ttk.ru/v/${space.id}`
    })
  }

  // Если открыт редактор — разворачиваем его во весь экран
  if (currentTab === 'editor' && selectedSpace) {
    return (
      <EditorView
        space={selectedSpace}
        onBack={() => {
          loadSpaces()
          setCurrentTab('dashboard')
        }}
        onUpdateSpace={handleUpdateSpace}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white text-[#111113] flex flex-col font-sans">
      {/* Шапка сайта */}
      <Navbar
        currentTab={currentTab}
        onNavigate={tab => setCurrentTab(tab)}
      />

      {/* Основной контент */}
      <main className="flex-1">
        {currentTab === 'landing' ? (
          <LandingView
            onOpenCreate={() => setIsCreateOpen(true)}
          />
        ) : (
          <DashboardView
            spaces={spaces}
            onOpenCreate={() => setIsCreateOpen(true)}
            onOpenEditor={handleOpenEditor}
            onOpenQR={handleOpenQR}
            onRefresh={loadSpaces}
          />
        )}
      </main>

      {/* Модальное окно создания объекта */}
      <CreateSpaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />

      {/* Модальное окно QR-кода */}
      <QRCodeModal
        isOpen={qrModalData.isOpen}
        onClose={() => setQrModalData(prev => ({ ...prev, isOpen: false }))}
        title={qrModalData.title}
        url={qrModalData.url}
      />
    </div>
  )
}
