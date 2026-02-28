import { getAuthUserDetails } from '@/lib/queries'
import React from 'react'
import MenuOptions from './menu-options'
import { Client, Role } from '@prisma/client'
import { ProjectWithDetails } from '@/lib/types'

type Props = {
  id: string
  type: 'user' | 'client' | 'project'
  clients?: Array<{
    client: Client & { 
      projects: ProjectWithDetails[]
    }
    role: string
  }>
  currentProject?: ProjectWithDetails
}

const Sidebar = async ({ id, type, clients, currentProject }: Props) => {
  const user = await getAuthUserDetails()
  if (!user) return null
  
  // Get details based on type
  const details = type === 'user' 
    ? { 
        id: user.id, 
        type: 'user' as const,
        email: user.email,
        image: user.image,
        role: user.role // Ensure role is included
      }
    : type === 'client'
    ? { 
        id: clients?.find(c => c.client.id === id)?.client.id || '',
        type: 'client' as const,
        companyLogo: clients?.find(c => c.client.id === id)?.client.companyLogo || null
      }
    : { 
        id: currentProject?.id || '',
        type: 'project' as const,
        name: currentProject?.name || ''
      }

  // Set sidebar logo/title
  const sideBarContent = type === 'user'
    ? { type: 'text', content: 'GreenBook' }
    : type === 'client'
    ? { type: 'logo', content: details.companyLogo || '/assets/default-company.svg' }
    : { type: 'text', content: details.name || '' }

  // Get current client role with strict type checking
  const currentClientRole = (() => {
    // If user is admin, they have admin access everywhere
    if (user.role === 'ADMIN') return 'ADMIN'
    
    // For user's own dashboard, use their role
    if (type === 'user') return user.role

    // For client pages
    if (type === 'client') {
      const role = clients?.find(c => c.client.id === id)?.role
      return role || user.role // Fall back to user's role if no client role found
    }

    // For project pages
    if (type === 'project' && currentProject) {
      const role = clients?.find(c => c.client.id === currentProject.clientId)?.role
      return role || user.role // Fall back to user's role if no client role found
    }

    return user.role // Default to user's role
  })()

  // Define sidebar options based on type and role with strict checking
  const sidebarOpt = (() => {
    if (type === 'user') {
      // Ensure we're checking the user's role from the database
      return user.role === 'ADMIN'
        ? [
            { id: '1', name: 'Dashboard', icon: 'home', link: `/user/${id}` },
            { id: '2', name: 'Clients', icon: 'person', link: `/user/${id}/all-clients` },
            { id: '3', name: 'Employee Access', icon: 'shield', link: `/admin/employee-access` },
            { id: '4', name: 'Settings', icon: 'settings', link: `/user/${id}/settings` }
          ]
        : [
            { id: '1', name: 'Dashboard', icon: 'home', link: `/user/${id}` },
            { id: '2', name: 'Clients', icon: 'person', link: `/user/${id}/all-clients` },
            { id: '3', name: 'Settings', icon: 'settings', link: `/user/${id}/settings` }
          ]
    }

    if (type === 'client') {
      // Admin and regular users see all options
      if (currentClientRole === 'ADMIN' || currentClientRole === 'USER') {
        return [
          { id: '1', name: 'Overview', icon: 'home', link: `/client/${id}` },
          { id: '2', name: 'Projects', icon: 'star', link: `/client/${id}/projects` },
          { id: '3', name: 'Team', icon: 'person', link: `/client/${id}/team` },
          { id: '4', name: 'Settings', icon: 'settings', link: `/client/${id}/settings` }
        ]
      }
      // Guest users see limited options
      return [
        { id: '1', name: 'Overview', icon: 'home', link: `/client/${id}` },
        { id: '2', name: 'Projects', icon: 'star', link: `/client/${id}/projects` }
      ]
    }

    // Project type
    // Admin and regular users see all options
    if (currentClientRole === 'ADMIN' || currentClientRole === 'USER') {
      return [
        { id: '1', name: 'Overview', icon: 'home', link: `/client/${currentProject?.clientId}/projects/${id}` },
        { id: '2', name: 'Deploy', icon: 'lock', link: `/client/${currentProject?.clientId}/projects/${id}/deploy` },
        { id: '3', name: 'Insights', icon: 'tune', link: `/client/${currentProject?.clientId}/projects/${id}/insights` },
        { id: '4', name: 'Settings', icon: 'settings', link: `/client/${currentProject?.clientId}/projects/${id}/settings` }
      ]
    }
    // Guest users see limited options
    return [
      { id: '1', name: 'Overview', icon: 'home', link: `/client/${currentProject?.clientId}/projects/${id}` },
      { id: '2', name: 'Insights', icon: 'tune', link: `/client/${currentProject?.clientId}/projects/${id}/insights` }
    ]
  })()

  return (
    <>
      <MenuOptions
        defaultOpen={true}
        details={{
          ...details,
          image: details.image || '/default-avatar.png',
          email: details.email || details.id,
          role: details.role || 'USER'  // Default to USER role if not specified
        }}
        sidebarContent={{
          type: sideBarContent.type as "text" | "logo",
          content: sideBarContent.content
        }}
        sidebarOpt={sidebarOpt}
        clients={clients || []}
      />
    </>
  )
}

export default Sidebar