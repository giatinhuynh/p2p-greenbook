import InfoBar from '@/components/global/infobar'
import Sidebar from '@/components/sidebar'
import { getAuthUserDetails } from '@/lib/queries'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  children: React.ReactNode
  params: Promise<{ userId: string }> | { userId: string }
}

const UserLayout = async ({ children, params }: Props) => {
  // Await the params if it's a promise
  const { userId } = await Promise.resolve(params)
  const user = await currentUser()
  
  if (!user) {
    return redirect('/user/sign-in')
  }

  // Get user details
  const userDetails = await getAuthUserDetails()
  if (!userDetails) {
    return redirect('/user')
  }

  // Verify this is the correct user
  if (userDetails.id !== userId) {
    return redirect(`/user/${userDetails.id}`)
  }

  return (
    <div className="h-screen overflow-hidden">
      <Sidebar
        id={userId}
        type="user"
      />
      <div className="md:pl-[300px]">
        <InfoBar
          role={userDetails.role}
        />
        <div className="relative">
          {children}
        </div>
      </div>
    </div>
  )
}

export default UserLayout