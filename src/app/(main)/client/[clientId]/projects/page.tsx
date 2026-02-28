import { getAuthUserDetails, getClientProjects } from '@/lib/queries'
import { Suspense } from 'react'
import ProjectsContainer from './projects-container'
import { ProjectWithDetails } from '@/lib/types'
import { headers } from 'next/headers'

interface PageProps {
  params: {
    clientId: string
  }
}

interface ProjectsResponse {
  user: any
  projects: ProjectWithDetails[]
  pagination: {
    total: number
    pages: number
    page: number
    limit: number
  }
}

async function getProjects(clientId: string): Promise<ProjectsResponse | null> {
  try {
    // Get user details with caching
    const user = await getAuthUserDetails()
    if (!user) return null

    // Get projects with pagination, bypass cache for admin users
    const bypassCache = user.role === 'ADMIN'
    const response = await getClientProjects(clientId, 1, 10, bypassCache)
    if (!response) return null

    return {
      user,
      projects: response.projects,
      pagination: response.pagination
    }
  } catch (error) {
    console.error('Error fetching projects:', error)
    return null
  }
}

export default async function ProjectsPage({ params }: PageProps) {
  const data = await getProjects(params.clientId)
  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No projects found</p>
      </div>
    )
  }

  return (
    <Suspense fallback={<div>Loading projects...</div>}>
      <ProjectsContainer
        clientId={params.clientId}
        initialProjects={data.projects}
        pagination={data.pagination}
        user={data.user}
      />
    </Suspense>
  )
}

// Generate metadata
export async function generateMetadata({ params }: PageProps) {
  const headersList = headers()
  return {
    title: 'Projects | GreenBook',
    description: 'View and manage your projects',
    headers: Object.fromEntries(headersList.entries())
  }
}
