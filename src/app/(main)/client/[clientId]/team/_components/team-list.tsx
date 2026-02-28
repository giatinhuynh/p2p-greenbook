'use client'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Role } from '@prisma/client'
import { CalendarDays, Mail, User2, Clock } from 'lucide-react'
import React from 'react'
import RemoveButton from './remove-button'

type Props = {
  clientId: string
  teamMembers: Array<{
    id: string
    role: Role
    isPending: boolean
    user: {
      id: string
      name: string
      email: string
      avatarUrl?: string
      createdAt: Date
    } | null
  }>
}

export const TeamList = ({ clientId, teamMembers }: Props) => {
  return (
    <div className="flex flex-col gap-4">
      {teamMembers.map((member) => (
        <Card key={member.id} className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <User2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{member.user?.name || 'Pending User'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Mail className="h-4 w-4" />
                <span>{member.user?.email || 'No email'}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <CalendarDays className="h-4 w-4" />
                <span>Joined {member.user?.createdAt ? new Date(member.user.createdAt).toLocaleDateString() : 'Pending'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end gap-2">
                <Badge className={
                  member.role === Role.ADMIN
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'bg-muted text-muted-foreground'
                }>
                  {member.role.toLowerCase()}
                </Badge>
                {member.isPending && (
                  <div className="flex items-center gap-1 text-yellow-600 text-sm">
                    <Clock className="h-3 w-3" />
                    <span>Pending</span>
                  </div>
                )}
              </div>
              {member.user && (
                <RemoveButton 
                  clientId={clientId}
                  userId={member.user.id}
                  userName={member.user.name}
                />
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}