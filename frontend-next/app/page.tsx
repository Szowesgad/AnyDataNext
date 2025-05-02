'use client'

import Link from 'next/link'
import { Button } from '../components/ui/button'

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-4xl font-bold mb-6">AnyDataset</h1>
      <p className="text-xl text-center max-w-2xl mb-8">
        Process any dataset with AI. Convert audio, text, and documents into structured data.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md">
        <Link href="/upload" className="w-full">
          <Button size="lg" className="w-full">
            Upload Single File
          </Button>
        </Link>
        <Link href="/batch" className="w-full">
          <Button size="lg" className="w-full" variant="outline">
            Batch Processing
          </Button>
        </Link>
      </div>
    </div>
  )
}