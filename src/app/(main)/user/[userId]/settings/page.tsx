'use server'

import UserDetails from '@/components/forms/user-details'
import BlurPage from '@/components/global/blur-page'
import { getAuthUserDetails } from '@/lib/queries'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import React from 'react'

type Props = {
  params: {
    userId: string
  }
}

const UserSettingsPage = async ({ params }: Props) => {
  const { userId } = params
  const authUser = await currentUser()
  
  if (!authUser) return redirect('/user/sign-in')
  
  if (userId !== authUser.id) {
    return redirect(`/user/${authUser.id}/settings`)
  }

  const userDetails = await getAuthUserDetails()
  if (!userDetails) return null

  return (
    <BlurPage>
      <div className="w-full max-w-5xl mx-auto px-4">
        <UserDetails
          id={authUser.id}
          userData={userDetails}
        />
      </div>
    </BlurPage>
  )
}

export default UserSettingsPage