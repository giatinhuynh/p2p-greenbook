import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { clerkClient, currentUser } from '@clerk/nextjs/server'
import { AuthorizationError } from '@/lib/errors'

// Helper to check if user is admin
async function verifyAdmin() {
  const user = await currentUser()
  if (!user) throw new AuthorizationError('Not authenticated')

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { role: true }
  })

  if (!dbUser || dbUser.role !== 'ADMIN') {
    throw new AuthorizationError('Not authorized')
  }

  return user
}

// Get all employee access entries
export async function GET() {
  try {
    await verifyAdmin()

    const entries = await db.employeeAccess.findMany({
      include: {
        addedBy: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(entries)
  } catch (error) {
    console.error('Failed to fetch employee access list:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: error instanceof AuthorizationError ? 403 : 500 }
    )
  }
}

// Add new employee access
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAdmin()
    const { email, notes } = await req.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existing = await db.employeeAccess.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Email already exists in employee access list' },
        { status: 400 }
      )
    }

    const entry = await db.employeeAccess.create({
      data: {
        email: email.toLowerCase(),
        notes,
        addedById: user.id,
        status: 'APPROVED' // Auto-approve when added by admin
      },
      include: {
        addedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Failed to add employee access:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: error instanceof AuthorizationError ? 403 : 500 }
    )
  }
}

// Update employee access status
export async function PATCH(req: NextRequest) {
  try {
    await verifyAdmin()
    const { id, status, notes } = await req.json()

    if (!id || !status) {
      return NextResponse.json(
        { error: 'ID and status are required' },
        { status: 400 }
      )
    }

    const entry = await db.employeeAccess.update({
      where: { id },
      data: { 
        status,
        notes: notes || undefined,
        updatedAt: new Date()
      },
      include: {
        addedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json(entry)
  } catch (error) {
    console.error('Failed to update employee access:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: error instanceof AuthorizationError ? 403 : 500 }
    )
  }
}

// Delete employee access
export async function DELETE(req: NextRequest) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      )
    }

    await db.employeeAccess.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete employee access:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: error instanceof AuthorizationError ? 403 : 500 }
    )
  }
} 