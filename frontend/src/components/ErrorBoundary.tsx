import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('UI Uncaught Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReset = () => {
    try {
      localStorage.removeItem('spacemap_user_auth')
      localStorage.removeItem('spacemap_jwt_token')
    } catch (_) {}
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-6 text-[#111113] font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#e9e9ec] shadow-xl text-center space-y-4">
            <div className="size-12 rounded-2xl bg-red-50 text-[#e30613] font-bold flex items-center justify-center mx-auto text-xl">
              ⚠️
            </div>
            <h2 className="text-lg font-bold text-[#111113]">Внимание</h2>
            <p className="text-xs text-[#6b6b70] leading-relaxed">
              Произошла ошибка при отрисовке интерфейса.
            </p>
            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-red-50 text-[11px] text-red-700 text-left font-mono break-all">
                {this.state.error.message}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#e30613] text-white text-xs font-bold hover:bg-[#c40511] transition"
              >
                Перезагрузить
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl border border-[#e9e9ec] text-[#111113] text-xs font-semibold hover:bg-[#fafafa] transition"
              >
                Сбросить кэш
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
