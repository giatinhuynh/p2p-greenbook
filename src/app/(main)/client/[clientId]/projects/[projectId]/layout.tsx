import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import { getAuthUserDetails, getProject } from '@/lib/queries'
import { currentUser } from '@clerk/nextjs/server'
import { Role } from '@prisma/client'
import { redirect } from 'next/navigation'
import React from 'react'
import { ProjectWithDetails } from '@/lib/types'

type Props = {
  children: React.ReactNode
  params: { 
    clientId: string
    projectId: string 
  }
}

const ProjectLayout = async ({ children, params }: Props) => {
  const resolvedParams = await Promise.resolve(params)
  const { projectId, clientId } = resolvedParams
  
  const user = await currentUser()
  
  if (!user) {
    return redirect('/')
  }

  const userDetails = await getAuthUserDetails()
  if (!userDetails) {
    return <Unauthorized />
  }

  const project = await getProject(projectId) as ProjectWithDetails
  if (!project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-muted-foreground">The project you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    )
  }

  // For USER role, allow access to all projects
  if (userDetails.role === 'USER') {
    return (
      <div className="flex h-full">
        <Sidebar
          id={projectId}
          type="project"
          clients={userDetails.clientUsers.map(cu => ({
            client: {
              ...cu.client,
              projects: project ? [project] : []
            },
            role: cu.role
          }))}
          currentProject={project}
        />
        <div className="flex-1">
          <InfoBar
            role="USER"
            clientId={clientId} 
          />
          <div className="p-8">
            {children}
          </div>
        </div>
      </div>
    )
  }

  // For GUEST role, check specific access
  const clientAccess = userDetails.clientUsers.find(
    cu => cu.client.projects.some(p => p.id === projectId)
  )

  if (!clientAccess) {
    return <Unauthorized />
  }

  return (
    <div className="relative">
      <Sidebar
        id={projectId}
        type="project"
        clients={[{
          client: {
            ...clientAccess.client,
            projects: project ? [project] : []
          },
          role: clientAccess.role
        }]}
        currentProject={project}
      />
      <InfoBar
        role={clientAccess.role as Role}
        clientId={clientAccess.client.id}
      />
      <div className="p-8">
        {children}
      </div>
    </div>
  )
}

export default ProjectLayout
