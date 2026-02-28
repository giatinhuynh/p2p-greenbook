import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(request: Request) {
  try {
    const authData = await auth()
    const url = new URL(request.url)
    const queryUserId = url.searchParams.get('userId')
    
    // Use either the authenticated user's ID or the query parameter
    const userId = authData?.userId || queryUserId
    
    if (!userId) {
      console.log('No user ID provided in request')
      return NextResponse.json({ error: 'No user ID provided' }, { status: 400 })
    }

    console.log('Attempting to fetch user role for ID:', userId)
    
    // The database query will naturally handle connection errors
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { 
        id: true,
        role: true 
      }
    })

    if (!user) {
      console.log('User not found in database:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('Successfully fetched user role:', { userId: user.id, role: user.role })
    return NextResponse.json({ userId: user.id, role: user.role })
  } catch (error) {
    // Enhanced error logging
    console.error('Detailed error in user role API:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error
    })
    
    // Check for specific database connection errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('Connection') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json({ 
        error: 'Database connection error',
        details: 'Unable to connect to database. Please check your database configuration.'
      }, { status: 503 })
    }
    
    // Return more specific error message
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage
    }, { status: 500 })
  }
} 