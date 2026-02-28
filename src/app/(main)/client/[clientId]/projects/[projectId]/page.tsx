import BlurPage from '@/components/global/blur-page'
import { getProject, getAuthUserDetails } from '@/lib/queries'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle} from '@/components/ui/card'
import { CalendarDays, ExternalLink, GitBranch, Github } from 'lucide-react'
import Link from 'next/link'
import { Role } from '@prisma/client'
import { ProjectWithDetails, UserWithClientDetails } from '@/lib/types'

type Props = {
  params: Promise<{
    projectId: string
    clientId: string
  }> | {
    projectId: string
    clientId: string
  }
}

const ProjectPage = async ({ params }: Props) => {
  const resolvedParams = await Promise.resolve(params)
  const { projectId, clientId } = resolvedParams
  
  const [project, userDetails] = await Promise.all([
    getProject(projectId) as Promise<ProjectWithDetails>,
    getAuthUserDetails() as Promise<UserWithClientDetails>
  ])

  if (!project || !userDetails) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Project Not Found</h1>
          <p className="text-muted-foreground">The project you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    )
  }

  // Get user's role in this client
  const clientUser = userDetails.clientUsers.find(cu => cu.client.id === clientId)
  const isGuest = clientUser?.role === Role.GUEST || userDetails.role === Role.GUEST

  const getGuestStatus = (status: string) => {
    // If there's a production deployment URL, it's always Active
    if (project.deploymentUrl) {
      return 'Active'
    }

    switch (status.toLowerCase()) {
      case 'deployed':
        return 'Active'
      case 'deploying':
        return 'Updating'
      case 'not_deployed':
      case 'failed':
      default:
        return 'Inactive'
    }
  }

  const getFormattedStatus = (status: string, isGuest: boolean) => {
    if (isGuest) {
      return getGuestStatus(status)
    }
    
    switch (status.toLowerCase()) {
      case 'deployed':
        return 'Deployed'
      case 'deploying':
        return 'Deploying'
      case 'failed':
        return 'Failed'
      case 'not_deployed':
      default:
        return 'Not Deployed'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'deployed':
      case 'active':
        return 'bg-green-500/10 text-green-500'
      case 'deploying':
      case 'updating':
        return 'bg-yellow-500/10 text-yellow-500'
      case 'failed':
      case 'inactive':
      case 'not deployed':
        return 'bg-red-500/10 text-red-500'
      default:
        return 'bg-gray-500/10 text-gray-500'
    }
  }

  const stats = [
    {
      title: isGuest ? 'Status' : 'Project Status',
      value: getFormattedStatus(project.status, isGuest),
      icon: GitBranch,
      description: isGuest ? 'Current status' : 'Current project status',
      badge: (
        <Badge className={getStatusColor(getFormattedStatus(project.status, isGuest))}>
          {getFormattedStatus(project.status, isGuest)}
        </Badge>
      )
    },
    {
      title: 'Created',
      value: new Date(project.createdAt).toLocaleDateString(),
      icon: CalendarDays,
      description: 'Project creation date'
    }
  ]

  return (
    <BlurPage>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2">
              <h1 className="text-4xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground">
                {project.description || 'No description provided'}
              </p>
            </div>
            <div className="flex gap-4">
              {!isGuest && project.repositoryUrl && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={project.repositoryUrl} target="_blank">
                    <Github className="h-4 w-4 mr-2" />
                    Repository
                  </Link>
                </Button>
              )}
              {project.deploymentUrl && (
                <Button size="sm" asChild>
                  <Link href={project.deploymentUrl} target="_blank">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Live
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {stat.badge || stat.value}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </BlurPage>
  )
}

export default ProjectPage
