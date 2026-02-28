import BlurPage from '@/components/global/blur-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserDetails } from '@/lib/queries'
import { ProjectStatus, Role } from '@prisma/client'
import { Building2, FolderGit2, Users2 } from 'lucide-react'
import { redirect } from 'next/navigation'
import React from 'react'

const ClientDashboardPage = async () => {
  const user = await getAuthUserDetails()
  if (!user) return redirect('/')

  // For ADMIN and USER roles, get all clients and their projects
  // For GUEST role, only get their assigned client
  const accessibleClients = user.role === Role.GUEST
    ? user.clientUsers.map(cu => cu.client)
    : [
        ...user.clientUsers.map(cu => cu.client)
      ].reduce((unique, client) => {
        const exists = unique.find((u: { id: string }) => u.id === client.id)
        if (!exists) {
          unique.push(client)
        }
        return unique
      }, [] as Array<typeof user.clientUsers[number]['client']>)

  // Calculate total stats across all accessible clients
  const totalStats = accessibleClients.reduce((acc, client) => {
    return {
      projects: acc.projects + (client.projects?.length || 0),
      teamMembers: acc.teamMembers + 1, // Count the client itself as a team member
      deployed: acc.deployed + (client.projects?.filter(p => p.status === ProjectStatus.DEPLOYED).length || 0),
      inProgress: acc.inProgress + (client.projects?.filter(p => p.status === ProjectStatus.DEPLOYING).length || 0),
      failed: acc.failed + (client.projects?.filter(p => p.status === ProjectStatus.FAILED).length || 0),
    }
  }, { projects: 0, teamMembers: 0, deployed: 0, inProgress: 0, failed: 0 })

  const stats = [
    {
      id: 'projects',
      title: 'Total Projects',
      value: totalStats.projects,
      icon: FolderGit2,
      description: 'All projects across clients',
      items: [
        { label: 'Deployed', value: totalStats.deployed },
        { label: 'In Progress', value: totalStats.inProgress },
        { label: 'Failed', value: totalStats.failed },
      ]
    },
    {
      id: 'clients',
      title: 'Clients', 
      value: accessibleClients.length,
      icon: Building2,
      description: 'Active clients',
      items: accessibleClients.map(client => ({
        label: client.companyName,
        value: client.projects?.length || 0
      }))
    },
    {
      id: 'team',
      title: 'Team Size',
      value: totalStats.teamMembers,
      icon: Users2,
      description: 'Total team members',
      items: accessibleClients.map(client => ({
        label: client.companyName,
        value: 1 // Each client counts as one team member
      }))
    }
  ]

  return (
    <BlurPage>
      <div className="relative h-full">
        <div className="flex flex-col gap-4 pb-6">
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <div className="grid gap-4 grid-cols-1 xl:grid-cols-3">
            {stats.map((stat) => (
              <Card key={stat.id} className="flex-1 relative">
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
      </div>
    </BlurPage>
  )
}

export default ClientDashboardPage