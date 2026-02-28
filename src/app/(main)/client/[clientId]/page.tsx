import BlurPage from '@/components/global/blur-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getClient, getAuthUserDetails } from '@/lib/queries'
import { Role } from '@prisma/client'
import { FolderGit2 } from 'lucide-react'
import React from 'react'
import { ClientWithProjects } from '@/lib/types'

type Props = {
  params: Promise<{ clientId: string }> | { clientId: string }
}

const ClientPage = async ({ params }: Props) => {
  try {
    // Ensure params are properly resolved
    const resolvedParams = await Promise.resolve(params)
    const { clientId } = resolvedParams
    
    // Add error boundary for client fetch
    let clientDetails, userDetails
    try {
      [clientDetails, userDetails] = await Promise.all([
        getClient(clientId) as Promise<ClientWithProjects>,
        getAuthUserDetails()
      ])
    } catch (error) {
      console.error('Error fetching client:', error)
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
            <p className="text-muted-foreground">
              Please try signing out and signing back in.
            </p>
          </div>
        </div>
      )
    }

    if (!clientDetails || !userDetails) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Client Not Found</h1>
            <p className="text-muted-foreground">
              The client you're looking for doesn't exist or you don't have access to it.
            </p>
          </div>
        </div>
      )
    }

    // Get user's role in this client
    const clientUser = userDetails.clientUsers.find(cu => cu.clientId === clientId)
    const isGuest = clientUser?.role === Role.GUEST || false

    const getGuestStatus = (status: string) => {
      switch (status.toLowerCase()) {
        case 'deployed':
          return 'Active'
        case 'not_deployed':
        case 'failed':
          return 'Inactive'
        case 'deploying':
          return 'Updating'
        default:
          return 'Inactive'
      }
    }

    const getFormattedStatus = (status: string, isGuest: boolean) => {
      if (isGuest) {
        return getGuestStatus(status)
      }
      
      switch (status.toLowerCase()) {
        case 'deployed':
          return 'Deployed'
        case 'deploying':
          return 'Deploying'
        case 'failed':
          return 'Failed'
        case 'not_deployed':
        default:
          return 'Not Deployed'
      }
    }

    // Group projects by status
    const projectStats = clientDetails.projects.reduce((acc, project) => {
      const status = getFormattedStatus(project.status, isGuest)
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const stats = [
      {
        title: 'Total Projects',
        value: clientDetails.projects.length,
        icon: FolderGit2,
        description: 'Active projects under this client',
        items: Object.entries(projectStats).map(([status, count]) => ({
          label: status,
          value: count
        }))
      }
    ]

    return (
      <BlurPage>
        <div className="relative h-full">
          <div className="flex flex-col gap-4 pb-6">
            <h1 className="text-4xl font-bold">Overview</h1>

            <div className="flex gap-6 flex-col xl:!flex-row">
              {stats.map((stat, index) => (
                <Card key={index} className="flex-1">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div className="space-y-1">
                      <CardDescription>{stat.title}</CardDescription>
                      <CardTitle className="text-4xl font-bold">{stat.value}</CardTitle>
                    </div>
                    <stat.icon className="h-6 w-6 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground pt-2">
                    {stat.description}
                    <div className="mt-4 space-y-2">
                      {stat.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span>{item.label}</span>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </BlurPage>
    )
  } catch (error) {
    console.error('Client page error:', error)
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Error</h1>
          <p className="text-muted-foreground">
            An error occurred while loading the client page.
          </p>
        </div>
      </div>
    )
  }
}

export default ClientPage