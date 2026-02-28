'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '../ui/textarea'
import { useToast } from '../ui/use-toast'
import { useModal } from '@/providers/modal-provider'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { ProjectStatus } from '@prisma/client'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

const formSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
  deploymentUrl: z.string().url().optional().or(z.literal('')),
})

type Project = {
  id: string
  name: string
  description: string | null
  repositoryUrl: string | null
  deploymentUrl: string | null
  status: ProjectStatus
  clientId: string
  createdAt: Date
  updatedAt: Date
}

type ProjectDetailsProps = {
  clientId: string
  project?: Project
  mode?: 'create' | 'edit'
}

const ProjectDetails = ({ clientId, project, mode = 'create' }: ProjectDetailsProps) => {
  const { toast } = useToast()
  const { setClose } = useModal()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: project?.name || '',
      description: project?.description || '',
      repositoryUrl: project?.repositoryUrl || '',
      deploymentUrl: project?.deploymentUrl || '',
    },
    mode: 'onBlur',
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      const payload = {
        name: values.name,
        description: values.description || null,
        repositoryUrl: values.repositoryUrl || null,
        deploymentUrl: values.deploymentUrl || null,
        clientId: clientId
      }

      console.log('Submitting update with payload:', payload)
      console.log('Project ID:', project?.id)
      console.log('Mode:', mode)

      const endpoint = mode === 'create' 
        ? '/api/projects/create'
        : project?.id 
          ? `/api/projects/${project.id}/update`
          : '/api/projects/create'

      console.log('Using endpoint:', endpoint)

      const response = await fetch(endpoint, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      console.log('Response status:', response.status)
      console.log('Response status text:', response.statusText)

      const responseData = await response.json()
      console.log('Response data:', responseData)

      if (!response.ok) {
        console.error('Update failed:', {
          status: response.status,
          statusText: response.statusText,
          error: responseData
        })
        throw new Error(
          responseData?.message || 
          `Failed to ${mode} project. ${response.status === 401 ? 'You may not have permission.' : 'Please try again.'}`
        )
      }

      if (mode === 'create') {
        setClose()
        router.push(`/client/${clientId}/projects/${responseData.id}`)
      } else {
        // First update the UI optimistically
        form.reset({
          name: responseData.name,
          description: responseData.description || '',
          repositoryUrl: responseData.repositoryUrl || '',
          deploymentUrl: responseData.deploymentUrl || '',
        })

        toast({
          title: 'Success',
          description: 'Project updated successfully.',
        })

        try {
          // Clear Redis cache
          await fetch(`/api/cache/invalidate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              patterns: [
                `project:${project?.id}*`,
                `client:${clientId}*`,
              ]
            })
          })

          // Fetch fresh data directly from database
          const freshData = await fetch(`/api/projects/${project?.id}/direct`)
            .then(res => res.json())
            .catch(error => {
              console.error('Failed to fetch fresh data:', error)
              return null
            })

          if (freshData) {
            // Update form with fresh data
            form.reset({
              name: freshData.name,
              description: freshData.description || '',
              repositoryUrl: freshData.repositoryUrl || '',
              deploymentUrl: freshData.deploymentUrl || '',
            })
          }

          // Revalidate paths in the background
          Promise.all([
            fetch(`/api/revalidate?path=/client/${clientId}/projects`),
            fetch(`/api/revalidate?path=/client/${clientId}/projects/${project?.id}`),
          ]).catch(error => {
            console.error('Failed to revalidate paths:', error)
          })

          // Refresh client data
          router.refresh()
        } catch (error) {
          console.error('Failed to update caches:', error)
        }
      }
    } catch (error) {
      console.error('Project operation error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : `Could not ${mode} project.`,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Create Project' : 'Project Settings'}</CardTitle>
        <CardDescription>
          {mode === 'create' 
            ? 'Create a new project for your client' 
            : 'Update your project settings'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div className="grid gap-6">
                {/* Project Name */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter project name" 
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Description */}
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter project description" 
                          className="resize-none"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Only show these fields in edit mode */}
              {mode === 'edit' && (
                <div className="grid gap-6 pt-2">
                  {/* Repository URL */}
                  <FormField
                    control={form.control}
                    name="repositoryUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Repository URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://github.com/user/repo" 
                            {...field}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Deployment URL */}
                  <FormField
                    control={form.control}
                    name="deploymentUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deployment URL</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://your-site.vercel.app" 
                            {...field}
                            disabled={isSubmitting}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button 
                type="submit" 
                className="w-[150px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {mode === 'create' ? 'Creating...' : 'Saving...'}
                  </>
                ) : (
                  mode === 'create' ? 'Create Project' : 'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  )
}

export default ProjectDetails