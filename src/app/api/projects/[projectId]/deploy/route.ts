import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProject, updateProject } from '@/lib/queries'
import { ApiResponse, DeploymentCreateInput, DeploymentResponse, ProjectWithDetails } from '@/lib/types'

type VercelProject = {
  id: string
  name: string
  gitRepository?: {
    type: string
    repo: string
    repoId: number | string
  }
}

function sanitizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> | { projectId: string } }
): Promise<NextResponse<ApiResponse<DeploymentResponse>>> {
  try {
    console.log('Starting deployment process...')
    const session = await auth()
    if (!session?.userId) {
      console.log('Unauthorized: No session found')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json() as DeploymentCreateInput
    const deploymentType = body.deploymentType || 'production'
    console.log('Deployment type:', deploymentType)

    const resolvedParams = await Promise.resolve(params)
    const { projectId } = resolvedParams
    console.log('Deploying project:', projectId)

    const project = await getProject(projectId) as ProjectWithDetails
    if (!project) {
      console.log('Project not found:', projectId)
      return new NextResponse('Project not found', { status: 404 })
    }

    if (!project.repositoryUrl) {
      return new NextResponse(
        JSON.stringify({
          error: 'Repository not configured',
          message: 'Please wait for the repository to be fully configured before deploying.',
        }),
        { 
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
    }

    const vercelToken = process.env.VERCEL_API_TOKEN
    if (!vercelToken) {
      throw new Error('Vercel API token not configured')
    }

    const repoPath = project.repositoryUrl.split('github.com/')[1]?.replace(/\.git$/, '')
    if (!repoPath) {
      throw new Error('Invalid repository URL format')
    }

    // Get GitHub repository ID
    const githubToken = process.env.GITHUB_ACCESS_TOKEN
    if (!githubToken) {
      throw new Error('GitHub token not configured')
    }

    const [owner, repo] = repoPath.split('/')
    const githubResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    })

    if (!githubResponse.ok) {
      throw new Error('Failed to fetch GitHub repository information')
    }

    const githubData = await githubResponse.json()
    const repoId = githubData.id.toString()

    // Check for existing Vercel projects
    console.log('Checking for existing Vercel projects...')
    const existingProjectResponse = await fetch(`https://api.vercel.com/v9/projects`, {
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
      },
    })

    if (!existingProjectResponse.ok) {
      console.error('Failed to fetch Vercel projects:', await existingProjectResponse.text())
      throw new Error('Failed to fetch Vercel projects')
    }

    const existingProjects = await existingProjectResponse.json()
    
    const existingProject = existingProjects.projects?.find((p: VercelProject) => {
      if (project.vercelProjectId && p.id === project.vercelProjectId) {
        return true
      }

      if (p.gitRepository?.type === 'github' && 
          p.gitRepository?.repo === repoPath &&
          p.gitRepository?.repoId === repoId) {
        return true
      }

      return false
    })

    let vercelProjectId: string = existingProject ? existingProject.id : ''
    let vercelProjectName: string = existingProject ? existingProject.name : ''

    if (existingProject) {
      // For production deployment, check if already deployed
      if (deploymentType === 'production') {
        // Check for existing deployments
        const existingDeploymentsResponse = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1`,
          {
            headers: {
              'Authorization': `Bearer ${vercelToken}`,
            },
          }
        )

        if (!existingDeploymentsResponse.ok) {
          throw new Error('Failed to check existing deployments')
        }

        const existingDeployments = await existingDeploymentsResponse.json()
        const latestDeployment = existingDeployments.deployments?.[0]

        // If there's already a successful deployment, return it
        if (latestDeployment?.state === 'READY' && latestDeployment?.readyState === 'READY') {
          console.log('Found existing successful deployment:', {
            projectId: vercelProjectId,
            url: latestDeployment.url,
            state: latestDeployment.state
          })

          const url = latestDeployment.url || ''
          const productionDomain = url.replace(/^[^-]+-/, '')

          // Update our database with the existing deployment info
          await updateProject(projectId, {
            status: 'DEPLOYED',
            deploymentUrl: `https://${productionDomain}.vercel.app`,
            previewUrl: latestDeployment.inspectorUrl || `https://${url}`,
            vercelProjectId
          })

          return NextResponse.json({
            success: true,
            data: {
              status: 'READY',
              url: latestDeployment.url,
              productionUrl: `https://${productionDomain}.vercel.app`,
              previewUrl: latestDeployment.inspectorUrl || `https://${url}`,
              alreadyDeployed: true
            } as DeploymentResponse
          })
        }
      }

      // Check for active deployments
      const activeDeploymentsResponse = await fetch(
        `https://api.vercel.com/v6/deployments?projectId=${vercelProjectId}&limit=1&state=BUILDING`,
        {
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
          },
        }
      )

      if (!activeDeploymentsResponse.ok) {
        throw new Error('Failed to check active deployments')
      }

      const activeDeployments = await activeDeploymentsResponse.json()
      if (activeDeployments.deployments?.length > 0) {
        return NextResponse.json({
          success: true,
          data: {
            status: 'BUILDING',
            deploymentId: activeDeployments.deployments[0].uid,
            alreadyDeployed: false
          } as DeploymentResponse
        })
      }
    } else {
      // Only create new project for production deployment
      if (deploymentType === 'production') {
        // Create new project with unique name
        const timestamp = Date.now().toString().slice(-6)
        vercelProjectName = sanitizeProjectName(`${project.name}-${timestamp}`)

        const createProjectResponse = await fetch('https://api.vercel.com/v9/projects', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: vercelProjectName,
            gitRepository: {
              type: 'github',
              repo: repoPath,
              repoId: repoId
            },
            framework: 'nextjs'
          }),
        })

        if (!createProjectResponse.ok) {
          const errorData = await createProjectResponse.json()
          throw new Error(`Failed to create Vercel project: ${errorData.error?.message || 'Unknown error'}`)
        }

        const newProject = await createProjectResponse.json()
        vercelProjectId = newProject.id

        await updateProject(projectId, {
          vercelProjectId: vercelProjectId
        })
      } else {
        return NextResponse.json({
          success: false,
          data: {
            status: 'ERROR',
            message: 'Project must be deployed to production first'
          } as DeploymentResponse
        }, { status: 400 })
      }
    }
    
    // Create deployment using the project ID
    console.log('Creating Vercel deployment:', {
      type: deploymentType,
      projectName: vercelProjectName,
      projectId: vercelProjectId,
      repoPath
    })

    const deploymentResponse = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: existingProject ? existingProject.name : vercelProjectName,
        project: vercelProjectId,
        gitSource: {
          type: 'github',
          repo: repoPath,
          ref: deploymentType === 'production' ? 'main' : 'HEAD',
          repoId: repoId
        },
        projectSettings: {
          framework: 'nextjs',
          buildCommand: 'npm run build',
          installCommand: 'npm install',
          outputDirectory: '.next',
          devCommand: null,
          rootDirectory: null
        }
      }),
    })

    if (!deploymentResponse.ok) {
      const errorData = await deploymentResponse.json()
      console.error('Vercel Deployment Error:', {
        error: errorData,
        projectId,
        vercelProjectId,
        repoPath
      })
      throw new Error(`Failed to create deployment: ${errorData.error?.message || 'Unknown error'}`)
    }

    const deployment = await deploymentResponse.json()
    console.log('Deployment created successfully:', {
      type: deploymentType,
      deploymentId: deployment.id,
      projectId,
      vercelProjectId
    })

    // Update initial status
    await updateProject(projectId, {
      status: 'DEPLOYING',
      deploymentId: deployment.id
    })

    console.log('Project status updated to DEPLOYING:', {
      projectId,
      deploymentId: deployment.id,
      vercelProjectId
    })

    return NextResponse.json({ 
      success: true,
      data: {
        status: 'BUILDING',
        deploymentId: deployment.id,
        projectId: vercelProjectId,
        message: `${deploymentType === 'production' ? 'Production' : 'Preview'} deployment started successfully`
      } as DeploymentResponse
    })
  } catch (error) {
    console.error('Deployment error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      projectId: params instanceof Promise ? undefined : params.projectId
    })
    
    try {
      const resolvedParams = await Promise.resolve(params)
      await updateProject(resolvedParams.projectId, {
        status: 'FAILED',
      })
      console.log('Project status updated to FAILED:', {
        projectId: resolvedParams.projectId
      })
    } catch (updateError) {
      console.error('Failed to update project status:', {
        error: updateError instanceof Error ? updateError.message : 'Unknown error',
        projectId: params instanceof Promise ? undefined : params.projectId
      })
    }

    return new NextResponse(
      error instanceof Error ? error.message : 'Internal Error',
      { status: 500 }
    )
  }
}