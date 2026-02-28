import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { applyRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: NextRequest) {
  console.log('Received email validation request')
  
  // Set CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  // Handle OPTIONS request for CORS
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { headers })
  }
  
  try {
    // Apply rate limiting
    try {
      await applyRateLimit(req, 'VALIDATE_EMAIL', 'auth')
    } catch (error) {
      console.log('Rate limit exceeded:', error)
      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { status: 429, headers }
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
        { status: 400, headers }
      )
    }

    const { email } = body

    if (!email) {
      console.log('Missing email in request')
      return new NextResponse(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers }
      )
    }

    const normalizedEmail = email.toLowerCase()
    console.log('Checking database for email:', normalizedEmail)

    // First check if user exists and get their role
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        role: true,
        email: true
      }
    })

    console.log('Database query result:', user)

    // If user is ADMIN or USER, allow them to proceed without checking employee access
    if (user && (user.role === 'ADMIN' || user.role === 'USER')) {
      console.log('User is ADMIN/USER, allowing access')
      
      // Log the validation attempt
      await db.authAttempt.create({
        data: {
          email: normalizedEmail,
          type: 'EMAIL_VALIDATION',
          success: true,
          ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
          userAgent: req.headers.get('user-agent') || 'unknown'
        }
      })

      return new NextResponse(
        JSON.stringify({
          exists: true,
          role: user.role,
          message: 'Email validated successfully'
        }),
        { status: 200, headers }
      )
    }

    // For non-ADMIN/USER, check employee access list
    const employeeAccess = await db.employeeAccess.findUnique({
      where: { 
        email: normalizedEmail
      }
    })

    // Check if the employee access exists and is approved
    const isApproved = employeeAccess?.status === 'APPROVED'

    // Log the validation attempt
    const authAttempt = await db.authAttempt.create({
      data: {
        email: normalizedEmail,
        type: 'EMAIL_VALIDATION',
        success: isApproved,
        ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent') || 'unknown'
      }
    })

    if (!isApproved) {
      console.log('Email not found in approved employee access list:', normalizedEmail)
      return new NextResponse(
        JSON.stringify({ 
          exists: false, 
          message: 'Email not authorized for employee access' 
        }),
        { status: 200, headers }
      )
    }

    // Update last login attempt for employee access
    await db.employeeAccess.update({
      where: { email: normalizedEmail },
      data: { lastLoginAt: new Date() }
    })

    // If user doesn't exist but has approved employee access, allow them to proceed
    if (!user) {
      console.log('User not found but has approved employee access:', normalizedEmail)
      return new NextResponse(
        JSON.stringify({ 
          exists: false,
          isApprovedEmployee: true,
          message: 'Email is approved for employee access. Please create an account to continue.' 
        }),
        { status: 200, headers }
      )
    }

    console.log('Validation successful for email:', normalizedEmail)
    return new NextResponse(
      JSON.stringify({
        exists: true,
        role: user.role,
        message: 'Email validated successfully'
      }),
      { status: 200, headers }
    )

  } catch (error) {
    console.error('Email validation error:', error)
    return new NextResponse(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers }
    )
  }
} 