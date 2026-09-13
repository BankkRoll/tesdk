import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { signOut } from './actions.ts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Fleet',
  description: 'Tesla Fleet API dashboard built with tesdk.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="topbar">
            <span className="wordmark">Fleet</span>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost">
                Sign out
              </button>
            </form>
          </header>
          {children}
        </div>
      </body>
    </html>
  )
}
