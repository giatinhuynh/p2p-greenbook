import ProjectDetails from '@/components/forms/project-details'
import { AnalyticsSettings } from '@/components/forms/analytics-settings'
import BlurPage from '@/components/global/blur-page'
import { getProject } from '@/lib/queries'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import React from 'react'
import { Project } from '@prisma/client'
import { db } from '@/lib/db'

type Props = {
  params: Promise<{
    projectId: string
    clientId: string
  }> | {
    projectId: string
    clientId: string
  }
}

type FormattedConfig = {
  gaPropertyId?: string
}

const defaultConfig: FormattedConfig = {
  gaPropertyId: ''
}

const ProjectSettingsPage = async ({ params }: Props) => {
  // Await params before destructuring
  const resolvedParams = await Promise.resolve(params)
  const { projectId, clientId } = resolvedParams

  const user = await currentUser()
  if (!user) return redirect('/')

  const project = await getProject(projectId) as Project
  if (!project) return null

  // Get analytics config
  const analyticsConfig = await db.analyticsConfig.findUnique({
    where: { projectId }
  }) as {
    id: string
    projectId: string
    gaPropertyId: string | null
    createdAt: Date
    updatedAt: Date
  } | null

  // Transform config to match form schema types
  const formattedConfig = analyticsConfig ? {
    ...defaultConfig,
    ...{
      gaPropertyId: analyticsConfig.gaPropertyId || undefined
    }
  } : undefined

  return (
    <BlurPage>
      <div className="flex lg:!flex-row flex-col gap-8">
        <div className="flex-1">
          <div className="grid gap-8">
            <ProjectDetails 
              project={project}
              clientId={clientId}
              mode="edit"
            />
            <AnalyticsSettings 
              projectId={projectId}
              initialConfig={formattedConfig}
            />
          </div>
        </div>
      </div>
    </BlurPage>
  )
}

export default ProjectSettingsPage