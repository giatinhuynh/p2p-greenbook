import BlurPage from '@/components/global/blur-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Ban } from 'lucide-react'
import React from 'react'

const UnauthorizedPage = () => {
  return (
    <BlurPage>
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Ban className="h-8 w-8 text-destructive" />
            <CardTitle>Unauthorized Access</CardTitle>
          </div>
          <CardDescription>
            You do not have permission to access this resource.
          </CardDescription>
        </CardHeader>
        <CardContent>
          Please contact your administrator if you believe this is a mistake.
        </CardContent>
      </Card>
    </BlurPage>
  )
}

export default UnauthorizedPage
