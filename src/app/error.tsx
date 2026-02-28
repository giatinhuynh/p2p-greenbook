'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex h-screen flex-col items-center justify-center space-y-4">
      <h1 className="text-4xl font-bold">Something went wrong!</h1>
      <p className="text-muted-foreground">
        An error occurred. Please try again later.
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
} 