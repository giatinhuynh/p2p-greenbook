import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import Unauthorized from '@/components/unauthorized'
import { getAuthUserDetails, getClientById } from '@/lib/queries'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import React from 'react'
import { db } from '@/lib/db'
import { FormattedClientData, ProjectWithDetails, UserWithClientDetails } from '@/lib/types'
import { Role } from '@prisma/client'

type Props = {
  children: React.ReactNode
  params: { clientId: string }
}

const ClientLayout = async ({ children, params }: Props) => {
  try {
    const { clientId } = params
    const clerkUser = await currentUser()
    
    if (!clerkUser?.id || !clerkUser?.emailAddresses?.[0]?.emailAddress) {
      return redirect('/')
    }

    const userDetails = await getAuthUserDetails()
    if (!userDetails) {
      // Initialize user if they don't exist in our database
      return redirect('/')
    }

    // Get all clients from the database with full project details
    const allClients = await db.client.findMany({
      include: {
        projects: {
          include: {
            client: {
              include: {
                clientUsers: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        },
        clientUsers: {
          include: {
            user: true
          }
        }
      }
    })

    // Format clients data for sidebar
    const formattedClients: FormattedClientData[] = allClients.map(client => ({
      client: {
        ...client,
        projects: client.projects as ProjectWithDetails[]
      },
      role: userDetails.role === 'USER' ? 'USER' as Role : 
            userDetails.clientUsers?.find(cu => cu.clientId === client.id)?.role || 'GUEST' as Role
    }))

    // For USER role, allow access to all clients
    if (userDetails.role === 'USER') {
      const clientDetails = await getClientById(clientId)
      if (!clientDetails) {
        return <Unauthorized />
      }

      return (
        <div className="h-screen overflow-hidden">
          <Sidebar
            id={clientId}
            type="client"
            clients={formattedClients}
          />
          <div className="md:pl-[300px]">
            <InfoBar />
            <div className="relative">
              {children}
            </div>
          </div>
        </div>
      )
    }

    // For GUEST role, check specific access
    const clientAccess = userDetails.clientUsers?.find(
      cu => cu.client.id === clientId
    )

    if (!clientAccess) {
      return <Unauthorized />
    }

    return (
      <div className="h-screen overflow-hidden">
        <Sidebar
          id={clientId}
          type="client"
          clients={formattedClients}
        />
        <div className="md:pl-[300px]">
          <InfoBar />
          <div className="relative">
            {children}
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in ClientLayout:', error)
    return <Unauthorized />
  }
}

export default ClientLayout