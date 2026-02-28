import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const authData = await auth()
    
    // Use either the authenticated user's ID or the path parameter
    const userId = authData?.userId || params.userId
    
    if (!userId) {
      return NextResponse.json({ error: 'No user ID provided' }, { status: 400 })
    }

    // Find the user's client relationship
    const clientUser = await db.clientUser.findFirst({
      where: {
        userId: userId,
        isPending: false
      },
      select: {
        clientId: true
      }
    })

    if (!clientUser) {
      return NextResponse.json({ error: 'No client found for user' }, { status: 404 })
    }

    return NextResponse.json({ clientId: clientUser.clientId })
  } catch (error) {
    console.error('Error fetching user client:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 