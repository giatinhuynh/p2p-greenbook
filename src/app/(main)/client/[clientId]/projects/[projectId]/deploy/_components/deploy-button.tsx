'use client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Rocket } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Loading from '@/components/global/loading'

type Props = {
  projectId: string
}

const DeployButton = ({ projectId }: Props) => {
  const [isDeploying, setIsDeploying] = useState(false)
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null)
  const { toast } = useToast()
  const router = useRouter()

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval)
      }
    }
  }, [pollInterval])

  const checkDeploymentStatus = async (deploymentId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/deployment-status`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check deployment status')
      }

      // If already deployed, stop polling immediately
      if (data.alreadyDeployed) {
        console.log('Found existing deployment:', {
          url: data.url,
          status: data.status,
          readyState: data.readyState
        })
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        setIsDeploying(false)
        router.refresh()
        return true
      }

      // Handle case where there are no deployments
      if (data.status === 'NO_DEPLOYMENTS') {
        console.log('No active deployments found')
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        setIsDeploying(false)
        return true
      }

      // Consider deployment complete when we have both READY status and a URL
      const isComplete = data.status === 'READY' && 
                        data.readyState === 'READY' && 
                        data.url

      if (isComplete) {
        // Stop polling immediately when deployment is complete
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }

        // Extract domain from URL (remove preview subdomain if present)
        const url = data.url || ''
        const productionDomain = url.replace(/^[^-]+-/, '')
        
        console.log('Deployment completed successfully:', {
          status: data.status,
          readyState: data.readyState,
          preview: data.url,
          production: productionDomain ? `https://${productionDomain}` : null,
          inspector: data.inspectorUrl
        })

        toast({
          title: 'Deployment Successful',
          description: 'Your project has been deployed successfully!',
          variant: 'default',
        })
        
        setIsDeploying(false)
        router.refresh()
        return true // Indicate successful completion
      } else if (data.status === 'ERROR' || data.status === 'CANCELED') {
        if (pollInterval) {
          clearInterval(pollInterval)
          setPollInterval(null)
        }
        console.log('Deployment failed:', {
          status: data.status,
          readyState: data.readyState,
          url: data.url
        })
        toast({
          title: 'Deployment Failed',
          description: 'The deployment process encountered an error.',
          variant: 'destructive',
        })
        setIsDeploying(false)
        router.refresh()
        return true // Indicate completion (even though failed)
      } else {
        // Log progress including URL if available
        console.log('Deployment in progress:', {
          status: data.status,
          readyState: data.readyState,
          url: data.url || 'not yet available',
          progress: data.readyState === 'READY' ? '100%' : 'building'
        })
      }
      return false // Not complete yet
    } catch (error) {
      console.error('Error checking deployment status:', error)
      if (pollInterval) {
        clearInterval(pollInterval)
        setPollInterval(null)
      }
      setIsDeploying(false)
      return true // Stop polling on error
    }
  }

  const startPolling = (deploymentId: string) => {
    // Check immediately
    checkDeploymentStatus(deploymentId)
    // Then start polling every 5 seconds
    const interval = setInterval(async () => {
      const isComplete = await checkDeploymentStatus(deploymentId)
      if (isComplete && pollInterval) {
        clearInterval(pollInterval)
        setPollInterval(null)
      }
    }, 5000)
    setPollInterval(interval)

    // Safety timeout after 3 minutes
    setTimeout(() => {
      if (pollInterval) {
        clearInterval(pollInterval)
        setPollInterval(null)
        // Do one final check before giving up
        checkDeploymentStatus(deploymentId)
      }
    }, 180000) // 3 minutes
  }

  const handleDeploy = async () => {
    try {
      setIsDeploying(true)
      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.status === 409) {
        // Project already deployed case
        toast({
          title: 'Project Already Deployed',
          description: data.message,
          variant: 'default'
        })
        
        if (data.deploymentUrl) {
          await fetch(`/api/projects/${projectId}/update`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              status: 'DEPLOYED',
              deploymentUrl: data.deploymentUrl,
            }),
          })
        }
        setIsDeploying(false)
      } else if (response.status === 400 && data.error === 'Repository not configured') {
        toast({
          variant: 'destructive',
          title: 'Repository Not Ready',
          description: data.message,
        })
        setIsDeploying(false)
      } else if (!response.ok) {
        throw new Error(data.error || 'Deployment failed')
      } else {
        toast({
          title: 'Deployment Started',
          description: 'Your project is being deployed. This may take a few minutes.',
        })
        // Start polling for status updates with the deployment ID
        startPolling(data.deploymentId)
      }

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Deployment Failed',
        description: error instanceof Error ? error.message : 'Could not deploy project',
      })
      setIsDeploying(false)
    }
  }

  return (
    <Button
      onClick={handleDeploy}
      disabled={isDeploying}
      className="gap-2"
    >
      {isDeploying ? (
        <>
          <Loading />
          Deploying...
        </>
      ) : (
        <>
          <Rocket className="h-4 w-4" />
          Deploy
        </>
      )}
    </Button>
  )
}

export default DeployButton