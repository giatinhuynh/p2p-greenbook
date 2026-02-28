'use client'
import React from 'react'
import { Card } from '../ui/card'
import { useRouter } from 'next/navigation'
import { Button } from '../ui/button'

const Unauthorized = () => {
  const router = useRouter()
  
  return (
    <div className="h-screen w-screen flex items-center justify-center">
      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-4">Unauthorized Access</h1>
        <p className="text-muted-foreground mb-4">
          You do not have permission to view this page.
        </p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </Card>
    </div>
  )
}

export default Unauthorized
