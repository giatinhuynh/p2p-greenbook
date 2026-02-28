import ClientDetails from '@/components/forms/client-details'
import BlurPage from '@/components/global/blur-page'
import { db } from '@/lib/db'
import { getAuthUserDetails } from '@/lib/queries'
import { currentUser } from '@clerk/nextjs/server'
import React from 'react'

type Props = {
  params: { clientId: string }
}

const ClientSettingPage = async ({ params }: Props) => {
  // Await params before destructuring
  const resolvedParams = await Promise.resolve(params)
  const { clientId } = resolvedParams
  
  const authUser = await currentUser()
  if (!authUser) return null

  const userDetails = await getAuthUserDetails()
  if (!userDetails) return null

  const client = await db.client.findUnique({
    where: { id: clientId },
  })
  if (!client) return null

  return (
    <BlurPage>
      <div className="flex lg:!flex-row flex-col gap-4">
        <ClientDetails 
          details={client}
        />
      </div>
    </BlurPage>
  )
}

export default ClientSettingPage
