import BlurPage from '@/components/global/blur-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getClient } from '@/lib/queries'
import { Role } from '@prisma/client'
import { Users2 } from 'lucide-react'
import React from 'react'
import { TeamList } from './_components/team-list'
import InviteButton from './_components/invite-button'
import { ClientWithProjects } from '@/lib/types'

type Props = {
  params: Promise<{ clientId: string }> | { clientId: string }
}

type TeamMember = {
  id: string
  role: Role
  isPending: boolean
  user: {
    id: string
    name: string
    email: string
    createdAt: Date
  } | null
}

const TeamPage = async ({ params }: Props) => {
  // Await params before destructuring
  const resolvedParams = await Promise.resolve(params)
  const { clientId } = resolvedParams
  
  const clientDetails = await getClient(clientId) as ClientWithProjects
  if (!clientDetails) return null

  // Get all guest members (both active and pending)
  const guestMembers = clientDetails.clientUsers.filter(member => 
    member.user && member.user.role === Role.GUEST
  )

  // Convert pending invitations to team member format
  const pendingMembers: TeamMember[] = (clientDetails.pendingInvitations || []).map(invite => ({
    id: invite.id,
    role: Role.GUEST,
    isPending: true,
    user: {
      id: invite.id,
      name: 'Invited User',
      email: invite.email,
      createdAt: invite.createdAt
    }
  }))

  // Combine active and pending members
  const allMembers = [...guestMembers, ...pendingMembers]

  const stats = [
    {
      title: 'Guest Members',
      value: guestMembers.length,
      icon: Users2,
      description: 'Active guest members in this client'
    },
    {
      title: 'Pending Invites',
      value: pendingMembers.length,
      icon: Users2,
      description: 'Pending team invitations'
    }
  ]

  return (
    <BlurPage>
      <div className="relative h-full">
        <div className="flex flex-col gap-4 pb-6">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold">Team</h1>
            <InviteButton clientId={clientId} />
          </div>

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
                </CardContent>
              </Card>
            ))}
          </div>

          <TeamList 
            clientId={clientId}
            teamMembers={allMembers}
          />
        </div>
      </div>
    </BlurPage>
  )
}

export default TeamPage
