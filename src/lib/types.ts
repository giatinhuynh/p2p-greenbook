import { Prisma, Role, User, Client, Project, ProjectStatus } from '@prisma/client'
import { z } from 'zod'

// Base Types
export type { Role, User, Client, Project, ProjectStatus }

// User Types
export type UserWithClientDetails = Prisma.UserGetPayload<{
  include: {
    clientUsers: {
      include: {
        client: {
          include: {
            projects: true
          }
        }
      }
    }
  }
}> & {
  image?: string | null
  name?: string | null
}

// Client Types
export type ClientWithProjects = Prisma.ClientGetPayload<{
  include: {
    projects: {
      include: {
        client: {
          include: {
            clientUsers: true
          }
        }
      }
    }
    clientUsers: {
      include: {
        user: true
      }
    }
    pendingInvitations: {
      select: {
        id: true
        email: true
        createdAt: true
      }
    }
  }
}>

export type FormattedClientData = {
  client: Client & {
    projects: ProjectWithDetails[]
    clientUsers: Prisma.ClientUserGetPayload<{
      include: {
        user: true
      }
    }>[]
  }
  role: Role
}

// Project Types
export interface ProjectFields extends Project {
  vercelProjectId: string | null
  deploymentId: string | null
  deploymentUrl: string | null
  previewUrl: string | null
  repositoryUrl: string | null
  name: string
  status: 'NOT_DEPLOYED' | 'DEPLOYING' | 'DEPLOYED' | 'FAILED'
}

export type ProjectWithClient = Prisma.ProjectGetPayload<{
  include: {
    client: true
  }
}> & ProjectFields

export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    client: {
      include: {
        clientUsers: {
          include: {
            user: true
          }
        }
      }
    }
  }
}> & ProjectFields

export type ProjectCreateInput = {
  name: string
  description?: string
  clientId: string
  repositoryUrl?: string
}

// Deployment Types
export type DeploymentStatus = 'READY' | 'ERROR' | 'BUILDING' | 'CANCELED' | 'NO_DEPLOYMENTS'

export type DeploymentResponse = {
  status: DeploymentStatus
  url?: string
  productionUrl?: string
  previewUrl?: string
  inspectorUrl?: string
  readyState?: string
  alreadyDeployed?: boolean
}

export type DeploymentCreateInput = {
  deploymentType: 'production' | 'preview'
}

// API Response Types
export type ApiResponse<T> = {
  data: T
  message?: string
  success: boolean
}

export type PaginatedResponse<T> = {
  data: T[]
  pagination: {
    total: number
    pages: number
    page: number
    limit: number
  }
}

export type ApiError = {
  message: string
  code: string
  details?: Record<string, unknown>
}

// Form Types
export type ClientFormData = z.infer<typeof ClientCreateSchema>
export type ProjectFormData = z.infer<typeof ProjectCreateSchema>

// Validation Schemas
export const ProjectCreateSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  clientId: z.string(),
  repositoryUrl: z.string()
})

export const ClientCreateSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email address'),
  companyPhone: z.string().optional(),
  companyLogo: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  createdById: z.string().min(1, 'Creator ID is required')
})

// Base Details type
type BaseDetails = {
  id: string
  name?: string
  companyLogo?: string | null
}

// User Details type
export type UserDetails = BaseDetails & (
  | { type: 'user' }
  | { type: 'client'; companyLogo: string | null }
  | { type: 'project' }
) & {
  email: string
  image: string
  role: Role
}

export interface MenuOption {
  id: string
  name: string
  icon: string
  link: string
}

export interface SidebarContent {
  type: 'text' | 'logo'
  content: string
}

export interface SidebarProps {
  id: string
  type: 'user' | 'client' | 'project'
  clients?: Array<{
    client: Client & { 
      projects: ProjectWithDetails[]
    }
    role: string
  }>
  currentProject?: ProjectWithDetails
}
