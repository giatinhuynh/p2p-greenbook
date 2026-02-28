import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  console.log('Received email validation request')
  
  try {
    // Apply rate limiting
    try {
      await applyRateLimit(req, 'VALIDATE_EMAIL', 'auth')
    } catch (error) {
      console.log('Rate limit exceeded:', error)
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      )
    }

    let body
    try {
      body = await req.json()
      console.log('Received request body:', body)
    } catch (e) {
      console.error('Failed to parse request body:', e)
      return new NextResponse(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      )
    }

    const { email } = body

    if (!email) {
      console.log('Missing email in request')
      return new NextResponse(
        JSON.stringify({ error: 'Email is required' }),
        { 
          status: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      )
    }

    console.log('Checking database for email:', email)

    // Check if user exists and get their role
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        role: true,
        email: true
      }
    })

    console.log('Database query result:', user)

    // Log the validation attempt
    const authAttempt = await db.authAttempt.create({
      data: {
        email: email.toLowerCase(),
        type: 'EMAIL_VALIDATION',
        success: !!user,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
    })

    console.log('Logged auth attempt:', authAttempt)

    if (!user) {
      console.log('User not found for email:', email)
      return new NextResponse(
        JSON.stringify({ exists: false, message: 'Email not found' }),
        { 
          status: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        }
      )
    }

    console.log('Validation successful for email:', email)
    return new NextResponse(
      JSON.stringify({
        exists: true,
        role: user.role,
        message: 'Email validated successfully'
      }),
      { 
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    )

  } catch (error) {
    console.error('Email validation error:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        }
      }
    )
  }
} 