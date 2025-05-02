import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AnyDataset',
  description: 'Process any dataset with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <header className="border-b">
            <div className="container mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="text-xl font-bold">
                AnyDataset
              </Link>
              <nav className="flex items-center gap-6">
                <Link href="/upload" className="text-sm hover:underline">
                  Upload
                </Link>
                <Link href="/batch" className="text-sm hover:underline">
                  Batch Process
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t py-4">
            <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
              © 2025 AnyDataset. All rights reserved.
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}