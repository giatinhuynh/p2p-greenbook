import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { updateClient } from '@/lib/server-actions'

export async function PATCH(
  req: Request,
  { params }: { params: { clientId: string } }
) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { clientId } = params
    
    if (!body || !clientId) {
      return new NextResponse('Invalid request: Missing required fields', { status: 400 })
    }

    const client = await updateClient(clientId, body)
    return NextResponse.json(client)
  } catch (error) {
    console.error('Client update error:', error)
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Error', 
      { status: 500 }
    )
  }
} 