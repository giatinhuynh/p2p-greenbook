import BlurPage from '@/components/global/blur-page'
import { getProject } from '@/lib/queries'
import DeploymentButtons from './_components/deployment-buttons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GitBranch, Globe, Rocket } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { auth } from '@clerk/nextjs/server'
import { ProjectWithDetails } from '@/lib/types'

type Props = {
  params: Promise<{
    projectId: string
    clientId: string
  }> | {
    projectId: string
    clientId: string
  }
}

const DeployPage = async ({ params }: Props) => {
  const resolvedParams = await Promise.resolve(params)
  const { projectId } = resolvedParams
  
  const project = await getProject(projectId) as ProjectWithDetails
  const session = await auth()
  if (!project) return null

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'deployed':
        return 'bg-green-500/10 text-green-500'
      case 'deploying':
        return 'bg-yellow-500/10 text-yellow-500'
      case 'failed':
        return 'bg-red-500/10 text-red-500'
      default:
        return 'bg-gray-500/10 text-gray-500'
    }
  }

  const isDeployed = project.status === 'DEPLOYED'
  const deploymentUrl = project.previewUrl || project.deploymentUrl

  return (
    <BlurPage>
      <div className="flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold">Deploy Project</h1>
          <DeploymentButtons 
            projectId={projectId} 
            isDeployed={isDeployed}
            status={project.status}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Deployment Status
              </CardTitle>
              <Rocket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge className={getStatusColor(project.status)}>
                {project.status.toLowerCase()}
              </Badge>
              <CardDescription className="mt-2">
                Current deployment status
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Repository
              </CardTitle>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {project.repositoryUrl ? (
                  <a 
                    href={project.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline text-sm"
                  >
                    View Repository
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Not connected
                  </span>
                )}
              </div>
              <CardDescription className="mt-2">
                GitHub repository status
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Preview URL
              </CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {deploymentUrl ? (
                  <a 
                    href={deploymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline text-sm"
                  >
                    View Preview
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Not deployed
                  </span>
                )}
              </div>
              <CardDescription className="mt-2">
                Preview deployment URL with development features
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </div>
    </BlurPage>
  )
}

export default DeployPage