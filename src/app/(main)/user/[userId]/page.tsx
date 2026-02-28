import BlurPage from '@/components/global/blur-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserDetails } from '@/lib/queries'
import { Building2, FolderGit2 } from 'lucide-react'
import React from 'react'
import { ProjectStatus } from '@prisma/client'
import { db } from '@/lib/db'


const UserPage = async () => {
  const userDetails = await getAuthUserDetails()
  if (!userDetails) return null

  // Get all clients and their projects if user has USER role
  let clientStats = {
    owned: 0,
    access: 0
  }
  
  let projectStats = {
    total: 0,
    byStatus: {} as Record<ProjectStatus, number>
  }

  if (userDetails.role === 'USER') {
    // Get all clients and projects for USER role
    const allClients = await db.client.findMany({
      include: {
        projects: true
      }
    })

    clientStats = {
      owned: allClients.length,
      access: allClients.length
    }

    projectStats = {
      total: allClients.reduce((acc, client) => 
        acc + (client.projects?.length || 0), 0),
      byStatus: allClients.reduce((acc, client) => {
        client.projects?.forEach((project) => {
          acc[project.status] = (acc[project.status] || 0) + 1
        })
        return acc
      }, {} as Record<ProjectStatus, number>)
    }
  } else {
    // For GUEST role, keep existing logic of counting only assigned clients
    clientStats = {
      owned: userDetails.clientUsers?.length || 0,
      access: userDetails.clientUsers?.length || 0
    }

    projectStats = {
      total: userDetails.clientUsers?.reduce((acc, cu) => 
        acc + (cu.client?.projects?.length || 0), 0) || 0,
      byStatus: userDetails.clientUsers?.reduce((acc, cu) => {
        cu.client?.projects?.forEach((project) => {
          acc[project.status] = (acc[project.status] || 0) + 1
        })
        return acc
      }, {} as Record<ProjectStatus, number>) || {}
    }
  }

  const stats = [
    {
      title: 'Clients Overview',
      value: clientStats.owned,
      icon: Building2,
      description: 'Client Access Breakdown',
      items: [
        { label: 'Total Clients', value: clientStats.owned }
      ]
    },
    {
      title: 'Projects Overview', 
      value: projectStats.total,
      icon: FolderGit2,
      description: 'Project Status Breakdown',
      items: [
        { label: 'Total Projects', value: projectStats.total },
        { label: 'Deployed', value: projectStats.byStatus[ProjectStatus.DEPLOYED] || 0 },
        { label: 'In Progress', value: projectStats.byStatus[ProjectStatus.DEPLOYING] || 0 },
        { label: 'Not Deployed', value: projectStats.byStatus[ProjectStatus.NOT_DEPLOYED] || 0 },
        { label: 'Failed', value: projectStats.byStatus[ProjectStatus.FAILED] || 0 }
      ]
    }
  ]

  return (
    <BlurPage>
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <div className="flex flex-col gap-4 md:flex-row">
          {stats.map((stat, index) => (
            <Card key={index} className="flex-1">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg font-medium">
                    {stat.title}
                  </CardTitle>
                  <CardDescription>{stat.description}</CardDescription>
                </div>
                <stat.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-3">
                <div className="text-3xl font-bold mb-4">{stat.value}</div>
                <div className="space-y-2">
                  {stat.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        {item.label}
                      </span>
                      <span className="text-sm font-medium">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </BlurPage>
  )
}

export default UserPage