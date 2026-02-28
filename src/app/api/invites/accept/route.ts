import { db } from '@/lib/db'
import { currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')
    
    if (!token) {
      return new NextResponse('Invalid invitation token', { status: 400 })
    }

    // Find the invitation
    const invitation = await db.pendingInvitation.findFirst({
      where: {
        id: token,
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        client: true
      }
    })

    if (!invitation) {
      return new NextResponse('Invalid or expired invitation', { status: 400 })
    }

    // Try to get current user if they're authenticated
    const user = await currentUser()

    // If user is not authenticated, redirect to sign-up with invitation token
    if (!user) {
      const signUpUrl = new URL('/user/sign-up', process.env.NEXT_PUBLIC_URL!)
      signUpUrl.searchParams.set('token', token)
      if (email) signUpUrl.searchParams.set('email', email)
      signUpUrl.searchParams.set('redirect_url', `/api/invites/accept?token=${token}`)
      return NextResponse.redirect(signUpUrl)
    }

    // Verify the email matches the invitation
    const userEmail = user.emailAddresses[0]?.emailAddress
    if (!userEmail || userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
      return new NextResponse('Email mismatch with invitation', { status: 400 })
    }

    try {
      // Check if user already exists in our database
      let dbUser = await db.user.findUnique({
        where: { email: userEmail }
      })

      if (!dbUser) {
        // Create the user if they don't exist
        dbUser = await db.user.create({
          data: { 
            id: user.id,
            email: userEmail,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            role: 'GUEST'
          }
        })
      }

      // Check if user is already a member of this client
      const existingMembership = await db.clientUser.findUnique({
        where: {
          clientId_userId: {
            clientId: invitation.clientId,
            userId: dbUser.id
          }
        }
      })

      if (!existingMembership) {
        // Create the client-user relationship
        await db.clientUser.create({
          data: {
            clientId: invitation.clientId,
            userId: dbUser.id,
            role: 'GUEST',
            isPending: false
          }
        })
      }

      // Delete the pending invitation
      await db.pendingInvitation.delete({
        where: { id: invitation.id }
      })

      // Redirect to the client page
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/client/${invitation.clientId}`)
    } catch (error) {
      console.error('Error updating records:', error)
      return new NextResponse('Failed to process invitation', { status: 500 })
    }
  } catch (error) {
    console.error('Accept invite error:', error)
    return new NextResponse('Internal error', { status: 500 })
  }
}  
