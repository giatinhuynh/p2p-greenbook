'use client'

import BlurPage from '@/components/global/blur-page'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import CreateProjectButton from './_components/create-project-btn'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, ExternalLink, GitBranch } from 'lucide-react'
import DeleteProjectButton from './_components/delete-project-btn'
import { Role } from '@prisma/client'
import { ProjectWithDetails } from '@/lib/types'
import { useState, useCallback, useMemo } from 'react'

interface Props {
  clientId: string
  initialProjects: ProjectWithDetails[]
  pagination: {
    total: number
    pages: number
    page: number
    limit: number
  }
  user: any
}

export default function ProjectsContainer({ clientId, initialProjects = [], pagination, user }: Props) {
  const [projects] = useState(initialProjects || [])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Get user's role in this client
  const clientUser = useMemo(() => 
    user?.clientUsers?.find((cu: any) => cu.client.id === clientId),
    [user?.clientUsers, clientId]
  )
  const isGuest = clientUser?.role === Role.GUEST || false

  const getGuestStatus = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'deployed':
        return 'Active'
      case 'not_deployed':
      case 'failed':
        return 'Inactive'
      case 'deploying':
        return 'Updating'
      default:
        return 'Inactive'
    }
  }, [])

  const getFormattedStatus = useCallback((status: string, isGuest: boolean) => {
    if (isGuest) {
      return getGuestStatus(status)
    }
    
    switch (status?.toLowerCase()) {
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
  }, [getGuestStatus])

  const getStatusColor = useCallback((status: string) => {
    switch (status?.toLowerCase()) {
      case 'deployed':
      case 'active':
        return 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
      case 'deploying':
      case 'updating':
        return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
      case 'failed':
      case 'inactive':
      case 'not deployed':
        return 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
      default:
        return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'
    }
  }, [])

  // Filter projects based on search query
  const filteredProjects = useMemo(() => {
    if (!projects) return []
    if (!searchQuery) return projects
    const query = searchQuery.toLowerCase()
    return projects.filter(project => 
      project?.name?.toLowerCase().includes(query) ||
      project?.description?.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  if (!user) {
    return null
  }

  return (
    <BlurPage>
      <div className="flex flex-col">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-bold">Projects</h1>
          {!isGuest && (
            <CreateProjectButton
              clientId={clientId}
              className="w-[200px] self-end m-6"
            />
          )}
        </div>
        
        <Command className="rounded-lg bg-transparent">
          <CommandInput 
            placeholder="Search Projects..." 
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No Projects Found.</CommandEmpty>
            <CommandGroup heading="Projects">
              {filteredProjects?.length > 0 ? (
                filteredProjects.map((project) => (
                  <CommandItem
                    key={project.id}
                    className="h-auto !bg-background my-2 text-foreground border-[1px] border-border p-6 rounded-lg hover:!bg-background/50 cursor-pointer transition-all"
                  >
                    <div className="flex flex-col gap-4 w-full h-full">
                      <div className="flex justify-between items-start w-full">
                        <Link
                          href={`/client/${clientId}/projects/${project.id}`}
                          className="flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <GitBranch className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-semibold text-lg text-foreground">{project.name}</h3>
                          </div>
                          <p className="text-muted-foreground text-sm">
                            {project.description || 'No description provided'}
                          </p>
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge className={`${getStatusColor(getFormattedStatus(project.status, isGuest))}`}>
                            {getFormattedStatus(project.status, isGuest)}
                          </Badge>
                          {!isGuest && (
                            <DeleteProjectButton
                              projectId={project.id}
                              projectName={project.name}
                            />
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <CalendarDays className="h-4 w-4" />
                          <span>
                            Created {new Date(project.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {project.deploymentUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2"
                            asChild
                          >
                            <Link href={project.deploymentUrl} target="_blank">
                              <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              <span className="text-foreground">View Live</span>
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))
              ) : (
                <div className="text-muted-foreground text-center p-4">
                  No Projects
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </BlurPage>
  )
} 