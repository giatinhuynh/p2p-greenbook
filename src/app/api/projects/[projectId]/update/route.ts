import { NextResponse } from 'next/server'
import { updateProject } from '@/lib/server-actions'
import { auth } from '@clerk/nextjs/server'
import { Project, ProjectStatus } from '@prisma/client'

export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    console.log('API Route - Received update request:', { params })
    
    const session = await auth()
    if (!session?.userId) {
      console.log('API Route - Unauthorized: No session')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { projectId } = params
    
    console.log('API Route - Processing update:', {
      projectId,
      userId: session.userId,
      body
    })

    // Validate required fields
    if (!body || !projectId) {
      console.log('API Route - Missing required fields:', { body, projectId })
      return new NextResponse('Invalid request: Missing required fields', { status: 400 })
    }

    // Only update the fields that are provided in the request
    const updateData: Partial<Project> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.description !== undefined) updateData.description = body.description
    if (body.repositoryUrl !== undefined) updateData.repositoryUrl = body.repositoryUrl
    if (body.deploymentUrl !== undefined) updateData.deploymentUrl = body.deploymentUrl
    if (body.status !== undefined) updateData.status = body.status as ProjectStatus

    console.log('API Route - Processed update data:', updateData)

    try {
      const project = await updateProject(projectId, updateData)
      console.log('API Route - Update successful:', project)
      return NextResponse.json(project)
    } catch (updateError) {
      console.error('API Route - Update failed:', updateError)
      return new NextResponse(
        updateError instanceof Error ? updateError.message : 'Failed to update project',
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('API Route - Project update error:', error)
    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Error', 
      { status: 500 }
    )
  }
}