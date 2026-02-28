'use client'
import { ModeToggle } from '@/components/global/mode-toggle'
import { SignedIn, SignedOut, UserButton, useAuth } from '@clerk/nextjs'
import Image from 'next/image'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

const Navigation = () => {
  const { userId } = useAuth()
  const [dashboardLink, setDashboardLink] = useState('/user')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!userId) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        // Fetch user role
        const roleResponse = await fetch(`/api/user/role?userId=${userId}`)
        if (!roleResponse.ok) throw new Error('Failed to fetch user role')
        const roleData = await roleResponse.json()

        if (roleData.role === 'GUEST') {
          // If user is a guest, fetch their client ID
          const clientResponse = await fetch(`/api/user/${userId}/client`)
          if (!clientResponse.ok) throw new Error('Failed to fetch client data')
          const clientData = await clientResponse.json()
          
          if (clientData.clientId) {
            setDashboardLink(`/client/${clientData.clientId}`)
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        // Fallback to /user in case of error
        setDashboardLink('/user')
      } finally {
        setIsLoading(false)
      }
    }

    fetchUserRole()
  }, [userId])

  return (
    <div className="fixed top-0 right-0 left-0 p-4 flex items-center justify-between z-10">
      <nav className="flex items-center gap-4">
        <Image src="/assets/plura-logo.svg" width={40} height={40} alt="logo" />
        <span className="text-xl font-bold">GreenBook</span>
      </nav>
      <aside className="flex gap-2 items-center">
        <SignedIn>
          {!isLoading && (
            <Link
              href={dashboardLink}
              className="bg-primary text-white p-2 px-4 rounded-md hover:bg-primary/80"
            >
              Dashboard
            </Link>
          )}
          <UserButton afterSignOutUrl="/site" />
        </SignedIn>
        <SignedOut>
          <Link
            href="/user/sign-in"
            className="bg-primary text-white p-2 px-4 rounded-md hover:bg-primary/80"
          >
            Login
          </Link>
        </SignedOut>
        <ModeToggle />
      </aside>
    </div>
  )
}

export default Navigation
