import BlurPage from '@/components/global/blur-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthUserDetails } from '@/lib/queries'
import React from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import UserDetails from '@/components/forms/user-details'

const Page = async () => {
  const authUser = await currentUser()
  if (!authUser) return redirect('/')

  const user = await getAuthUserDetails()

  // If user doesn't exist in our database, show profile completion form
  if (!user) {
    return (
      <BlurPage>
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Complete Your Profile</CardTitle>
            <CardDescription>
              Please provide some additional information to complete your profile setup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserDetails
              id={authUser.id}
              userData={{
                name: `${authUser.firstName} ${authUser.lastName}`,
                email: authUser.emailAddresses[0].emailAddress,
                role: 'USER'
              }}
              isNewUser={true}
            />
          </CardContent>
        </Card>
      </BlurPage>
    )
  }

  // Redirect to user's dashboard if profile exists
  return redirect(`/user/${authUser.id}`)
}

export default Page