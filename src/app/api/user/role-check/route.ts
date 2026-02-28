import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Get the current user directly using Clerk's currentUser helper
    const user = await currentUser()
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        authenticated: false 
      }, { status: 401 })
    }
    
    // Log the user ID we're trying to look up
    console.log('Looking up user with ID:', user.id)
    
    // Try to find the user in our database
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, role: true }
    })
    
    if (!dbUser) {
      console.log('User not found in database:', user.id)
      
      // Return a default role if user not in database
      return NextResponse.json({ 
        userId: user.id, 
        role: 'GUEST',
        note: 'User not found in database, using default role'
      })
    }
    
    console.log('Found user role:', dbUser.role)
    
    return NextResponse.json({ 
      userId: dbUser.id, 
      role: dbUser.role,
      authenticated: true
    })
  } catch (error) {
    console.error('Error in role-check API:', error)
    
    // Check for specific database connection errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('Connection') || errorMessage.includes('timeout') || errorMessage.includes('ECONNREFUSED')) {
      return NextResponse.json({ 
        error: 'Database connection error',
        details: 'Unable to connect to database. Please check your database configuration.',
        authenticated: false
      }, { status: 503 })
    }
    
    // Return a more detailed error
    return NextResponse.json({ 
      error: 'Internal server error',
      details: errorMessage,
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, { status: 500 })
  }
} 