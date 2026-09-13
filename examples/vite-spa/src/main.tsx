/**
 * @file Browser entry point.
 *
 * Mounts the app inside an error boundary, because the most likely failure on
 * a first run is a missing `VITE_TESLA_CLIENT_ID` — a thrown configuration
 * error that would otherwise leave a blank page and the explanation buried in
 * the console.
 */

import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app.tsx'
import './styles/app.css'

/** Renders its children, or the error that stopped them. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | undefined }> {
  override state: { error: Error | undefined } = { error: undefined }

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="shell">
        <main className="signin">
          <div className="signin-inner">
            <h1>Not configured</h1>
            <div className="notice">
              <p>{error.message}</p>
            </div>
          </div>
        </main>
      </div>
    )
  }
}

const container = document.getElementById('root')
if (!container) throw new Error('index.html is missing the #root element')

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
