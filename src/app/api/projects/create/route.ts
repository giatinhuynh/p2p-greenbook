// app/api/projects/create/route.ts
import { NextResponse } from 'next/server'
import { ProjectAutomationService } from '@/services/project-automation'
import { createProject } from '@/lib/queries'
import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    console.log('Received request body:', body)
    
    // Validate required fields
    if (!body || !body.name || !body.clientId) {
      console.error('Invalid request: Missing required fields', {
        name: body?.name,
        clientId: body?.clientId
      })
      return new NextResponse('Invalid request: Missing required fields (name and clientId are required)', { status: 400 })
    }

    const { name, description, clientId } = body
    const automationService = new ProjectAutomationService()

    let repoUrl

    try {
      // Create GitHub repository
      repoUrl = await automationService.createGithubRepository(name)
      console.log('Created GitHub repository:', repoUrl)
    } catch (error) {
      console.error('GitHub repository creation failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return new NextResponse(`Failed to create GitHub repository: ${errorMessage}`, { status: 500 })
    }

    try {
      // Validate that we have the required data before database creation
      if (!repoUrl) {
        console.error('Missing required data:', { repoUrl })
        return new NextResponse('Missing required data for project creation', { status: 500 })
      }

      // Create project in database
      const projectData = {
        name,
        description: description || '',
        clientId,
        repositoryUrl: repoUrl
      }

      console.log('Creating project with data:', projectData)
      
      const project = await createProject(projectData)
      console.log('Created project:', project)

      return NextResponse.json(project, { status: 201 })
    } catch (error) {
      console.error('Database project creation failed:', error)
      return new NextResponse('Failed to create project in database', { status: 500 })
    }
  } catch (error) {
    console.error('Project creation error:', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}