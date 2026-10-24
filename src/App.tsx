import { useState, useEffect } from 'react'
import type { SpaceObject } from './types/space'
import type { UserProfile } from './types/auth'
import { getSpaces, getStoredUser, saveStoredUser } from './utils/storage'
import { Navbar } from './components/Navbar'
import { LandingView } from './components/LandingView'
import { DashboardView } from './components/DashboardView'
import { EditorView } from './components/EditorView'
import { CreateSpaceModal } from './components/CreateSpaceModal'
import { QRCodeModal } from './components/QRCodeModal'
import { AuthModal } from './components/AuthModal'
import { ProfileSettingsModal } from './components/ProfileSettingsModal'

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

  // Авторизация пользователя
  const [user, setUser] = useState<UserProfile | null>(() => getStoredUser())
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; tab: 'login' | 'register' }>({
    isOpen: false,
    tab: 'login'
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const loadSpaces = () => {
    const list = getSpaces()
    setSpaces(list)
  }

  useEffect(() => {
    loadSpaces()
  }, [])

  const handleOpenAuth = (tab: 'login' | 'register') => {
    setAuthModal({ isOpen: true, tab })
  }

  const handleLoginSuccess = (newUser: UserProfile) => {
    setUser(newUser)
    saveStoredUser(newUser)
  }

  const handleLogout = () => {
    setUser(null)
    saveStoredUser(null)
  }

  const handleUpdateUser = (updated: UserProfile) => {
    setUser(updated)
    saveStoredUser(updated)
  }

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
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
      />

      {/* Основной контент */}
      <main className="flex-1">
        {currentTab === 'landing' ? (
          <LandingView
            user={user}
            onOpenCreate={() => {
              if (user) {
                setIsCreateOpen(true)
              } else {
                handleOpenAuth('register')
              }
            }}
            onNavigateToDashboard={() => setCurrentTab('dashboard')}
          />
        ) : (
          <DashboardView
            user={user}
            spaces={spaces}
            onOpenCreate={() => {
              if (user) {
                setIsCreateOpen(true)
              } else {
                handleOpenAuth('login')
              }
            }}
            onOpenEditor={handleOpenEditor}
            onOpenQR={handleOpenQR}
            onOpenAuth={handleOpenAuth}
            onRefresh={loadSpaces}
          />
        )}
      </main>

      {/* Модальное окно авторизации (Вход / Регистрация) */}
      <AuthModal
        isOpen={authModal.isOpen}
        initialTab={authModal.tab}
        onClose={() => setAuthModal(prev => ({ ...prev, isOpen: false }))}
        onSuccess={handleLoginSuccess}
      />

      {/* Модальное окно настроек профиля */}
      <ProfileSettingsModal
        isOpen={isSettingsOpen}
        user={user}
        onClose={() => setIsSettingsOpen(false)}
        onUpdate={handleUpdateUser}
        onLogout={handleLogout}
      />

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
