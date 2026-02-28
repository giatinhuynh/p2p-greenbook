import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProject, updateProject } from '@/lib/queries'
import { ApiResponse, DeploymentResponse, DeploymentStatus, ProjectWithDetails } from '@/lib/types'
import { headers } from 'next/headers'

async function getLatestDeployment(projectId: string, vercelToken: string): Promise<DeploymentResponse> {
  console.log('Fetching latest deployment from Vercel:', { projectId })
  
  try {
    // First try to get the production deployment - limit to 1 for efficiency
    const prodResponse = await fetch(
      `https://api.vercel.com/v6/deployments?target=production&projectId=${projectId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      }
    )

    if (!prodResponse.ok) {
      const errorText = await prodResponse.text()
      console.error('Failed to fetch production deployment:', { projectId, error: errorText })
      throw new Error('Failed to fetch deployment status')
    }

    const prodData = await prodResponse.json()
    const prodDeployment = prodData.deployments?.[0]

    // Only fetch preview if we have a production deployment
    let previewUrl = null
    if (prodDeployment?.state === 'READY') {
      // Get latest preview deployment - limit to 1 for efficiency
      const previewResponse = await fetch(
        `https://api.vercel.com/v6/deployments?target=preview&projectId=${projectId}&limit=1`,
        {
          headers: {
            'Authorization': `Bearer ${vercelToken}`,
          },
        }
      )

      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        const previewDeployment = previewData.deployments?.[0]
        if (previewDeployment?.state === 'READY' && previewDeployment?.readyState === 'READY') {
          previewUrl = `https://vercel.com/project-plutos-projects/${previewDeployment.url.split('.')[0]}/${previewDeployment.uid}`
        }
      }
    }

    // If we have a production deployment, return it with additional info
    if (prodDeployment?.state === 'READY' && prodDeployment?.readyState === 'READY') {
      console.log('Found existing production deployment:', {
        url: prodDeployment.url,
        alias: prodDeployment.alias,
        target: prodDeployment.target,
        previewUrl
      })
      
      // Extract just the project ID part (e.g., newing-brochure-765808)
      const projectUrlPart = prodDeployment.url.split('-').slice(0, 3).join('-')
      const mainDomain = `${projectUrlPart}.vercel.app`
      
      return {
        status: 'READY' as DeploymentStatus,
        alreadyDeployed: true,
        productionUrl: `https://${mainDomain}`,
        previewUrl: previewUrl || `https://vercel.com/project-plutos-projects/${mainDomain.split('.')[0]}/${prodDeployment.uid}`,
        url: mainDomain,
        readyState: 'READY'
      }
    }

    // If no production deployment found, just check latest deployment
    const response = await fetch(
      `https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${vercelToken}`,
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to fetch deployments:', { projectId, error: errorText })
      throw new Error('Failed to fetch deployment status')
    }

    const data = await response.json()
    const deployment = data.deployments?.[0]
    
    if (deployment) {
      console.log('Latest deployment info:', {
        state: deployment.state,
        url: deployment.url,
        readyState: deployment.readyState,
        target: deployment.target,
        previewUrl
      })
    }

    return {
      status: (deployment?.state || 'NO_DEPLOYMENTS') as DeploymentStatus,
      url: deployment?.url,
      previewUrl: previewUrl || (deployment?.url ? `https://vercel.com/project-plutos-projects/${deployment.url.split('.')[0]}/${deployment.uid}` : undefined),
      readyState: deployment?.readyState
    }
  } catch (error) {
    console.error('Error fetching deployments:', error)
    throw error
  }
}

async function checkDeploymentStatus(deploymentId: string, vercelToken: string): Promise<DeploymentResponse> {
  console.log('Checking specific deployment status:', { deploymentId })
  
  const response = await fetch(`https://api.vercel.com/v6/deployments/${deploymentId}`, {
    headers: {
      'Authorization': `Bearer ${vercelToken}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Failed to check deployment status:', { deploymentId, error: errorText })
    throw new Error('Failed to check deployment status')
  }

  const data = await response.json()
  console.log('Deployment status response:', {
    deploymentId,
    status: data.status,
    readyState: data.readyState,
    url: data.url,
    inspectorUrl: data.inspectorUrl
  })

  return {
    status: data.status as DeploymentStatus,
    url: data.url,
    previewUrl: data.url ? `https://vercel.com/project-plutos-projects/${data.url.split('.')[0]}/${data.uid}` : undefined,
    inspectorUrl: data.inspectorUrl,
    readyState: data.readyState
  }
}

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function GET(
  req: Request,
  { params }: { params: { projectId: string } }
): Promise<NextResponse<ApiResponse<DeploymentResponse>>> {
  const headersList = headers()
  
  try {
    console.log('Starting deployment status check for project:', params.projectId)
    const session = await auth()
    if (!session?.userId) {
      console.log('Unauthorized access attempt:', { projectId: params.projectId, userId: session?.userId })
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { projectId } = params
    const project = await getProject(projectId) as ProjectWithDetails
    
    if (!project) {
      console.log('Project not found:', { projectId })
      return new NextResponse('Project not found', { status: 404 })
    }

    if (!project.vercelProjectId) {
      console.log('No Vercel project ID found:', { projectId })
      return new NextResponse('Project not configured for deployment', { status: 400 })
    }

    const vercelToken = process.env.VERCEL_API_TOKEN
    if (!vercelToken) {
      console.error('Vercel API token not configured')
      throw new Error('Vercel API token not configured')
    }

    // First check latest deployment to see if we already have a successful one
    const latestDeployment = await getLatestDeployment(project.vercelProjectId, vercelToken)
    
    if (latestDeployment?.alreadyDeployed) {
      // If we have a successful deployment, update our database and return
      await updateProject(projectId, {
        status: 'DEPLOYED',
        deploymentUrl: latestDeployment.productionUrl, // Production URL for guest users
        previewUrl: latestDeployment.previewUrl, // Preview URL for admin/users
        deploymentId: null
      })

      return NextResponse.json({
        success: true,
        data: latestDeployment
      })
    }

    // If we have an active deployment, check its status
    let deploymentStatus = null
    if (project.deploymentId) {
      try {
        deploymentStatus = await checkDeploymentStatus(project.deploymentId, vercelToken)
      } catch (error) {
        console.log('Failed to get status of tracked deployment:', { 
          projectId,
          deploymentId: project.deploymentId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // If no active deployment and no successful previous deployment
    if (!deploymentStatus && !latestDeployment) {
      console.log('No deployments found:', { projectId, vercelProjectId: project.vercelProjectId })
      return NextResponse.json({
        success: true,
        data: { status: 'NO_DEPLOYMENTS' as DeploymentStatus }
      })
    }

    // Use latest deployment status if we don't have an active one
    if (!deploymentStatus && latestDeployment) {
      deploymentStatus = latestDeployment
    }

    // Consider deployment complete when we have both READY status and a URL
    const isComplete = deploymentStatus?.status === 'READY' && 
                      deploymentStatus?.readyState === 'READY' && 
                      deploymentStatus?.url

    if (isComplete || deploymentStatus?.status === 'ERROR' || deploymentStatus?.status === 'CANCELED') {
      console.log('Deployment status update:', {
        projectId,
        status: deploymentStatus?.status,
        readyState: deploymentStatus?.readyState,
        url: deploymentStatus?.url,
        previewUrl: deploymentStatus?.previewUrl
      })

      if (isComplete && deploymentStatus) {
        const productionUrl = `https://${deploymentStatus.url}`
        
        await updateProject(projectId, {
          status: 'DEPLOYED',
          deploymentUrl: productionUrl, // Production URL for guest users
          previewUrl: deploymentStatus.previewUrl || productionUrl, // Preview URL for admin/users
          deploymentId: null
        })

        console.log('Project marked as deployed:', {
          projectId,
          productionUrl,
          previewUrl: deploymentStatus.previewUrl || productionUrl
        })
      } else if (deploymentStatus) {
        await updateProject(projectId, {
          status: 'FAILED',
          deploymentId: null
        })
      }
    }

    // Set cache control headers to prevent caching
    const response = NextResponse.json(
      {
        success: true,
        data: deploymentStatus || { status: 'NO_DEPLOYMENTS' as DeploymentStatus }
      },
      {
        headers: {
          'Cache-Control': 'no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
    
    return response
  } catch (error) {
    console.error('Error checking deployment status:', error)
    return NextResponse.json(
      {
        success: false,
        data: { status: 'ERROR' as DeploymentStatus },
        error: 'Failed to check deployment status'
      },
      { status: 500 }
    )
  }
} 