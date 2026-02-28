import { NextResponse } from 'next/server'
import { getProjectDirect } from '@/lib/queries'
import { auth } from '@clerk/nextjs/server'

export async function GET(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const project = await getProjectDirect(params.projectId)
    if (!project) {
      return new NextResponse('Project not found', { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error fetching project:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
} 