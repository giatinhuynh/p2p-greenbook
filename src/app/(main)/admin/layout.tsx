import React from 'react'
import { getAuthUserDetails } from '@/lib/queries'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/sidebar'
import Infobar from '@/components/global/infobar'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

// Direct admin check function that doesn't rely on API routes
async function isUserAdmin() {
  try {
    // Get the current user from Clerk
    const user = await currentUser()
    if (!user) return false
    
    // Check the database directly
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true }
    })
    
    return dbUser?.role === 'ADMIN'
  } catch (error) {
    console.error('Error checking admin status:', error)
    return false
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // First, directly check if user is admin
  const isAdmin = await isUserAdmin()
  if (!isAdmin) {
    console.log('User is not an admin, redirecting to sign-in')
    redirect('/user/sign-in')
  }
  
  // If we get here, user is confirmed admin, now get full user details
  try {
    const user = await getAuthUserDetails()
    
    // If getAuthUserDetails fails, get minimal user info
    if (!user) {
      const clerkUser = await currentUser()
      if (!clerkUser) redirect('/user/sign-in')
      
      return (
        <div className="flex h-screen">
          <div className="w-[300px] shrink-0">
            <Sidebar 
              id={clerkUser.id}
              type="user"
            />
          </div>
          <div className="flex-1 flex flex-col">
            <Infobar />
            <main className="flex-1 overflow-y-auto pt-[73px] w-full">
              <div className="max-w-[calc(100vw-300px)] mx-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
      )
    }
    
    // Normal rendering with full user details
    return (
      <div className="flex h-screen">
        <div className="w-[300px] shrink-0">
          <Sidebar 
            id={user.id}
            type="user"
          />
        </div>
        <div className="flex-1 flex flex-col">
          <Infobar />
          <main className="flex-1 overflow-y-auto pt-[73px] w-full">
            <div className="max-w-[calc(100vw-300px)] mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    )
  } catch (error) {
    console.error('Error in admin layout:', error)
    redirect('/user/sign-in')
  }
} 