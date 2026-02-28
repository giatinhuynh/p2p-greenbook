'use client'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Rocket, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition, useOptimistic } from 'react'
import Loading from '@/components/global/loading'

type Props = {
  projectId: string
  isDeployed: boolean
  status: string
}

const DeploymentButtons = ({ projectId, isDeployed: initialIsDeployed, status: initialStatus }: Props) => {
  const [isDeploying, setIsDeploying] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const router = useRouter()

  // Optimistic state
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(
    initialStatus,
    (state, newStatus: string) => newStatus
  )
  const [optimisticIsDeployed, setOptimisticIsDeployed] = useOptimistic(
    initialIsDeployed,
    (state, newIsDeployed: boolean) => newIsDeployed
  )

  const checkDeploymentStatus = async () => {
    try {
      setIsChecking(true)
      
      const response = await fetch(`/api/projects/${projectId}/deployment-status`, {
        cache: 'no-store'
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check deployment status')
      }

      if (data.data?.status === 'READY' || 
          data.data?.readyState === 'READY' || 
          data.data?.alreadyDeployed) {
        const deploymentUrl = data.data.productionUrl || data.data.url
        
        // Optimistically update UI
        setOptimisticStatus('DEPLOYED')
        setOptimisticIsDeployed(true)
        
        toast({
          title: 'Deployment Status',
          description: deploymentUrl 
            ? `Project is successfully deployed and available at ${deploymentUrl}`
            : 'Project is successfully deployed.',
        })
        
        startTransition(() => {
          router.refresh()
        })
      } else if (data.data?.status === 'ERROR' || 
                data.data?.status === 'CANCELED' ||
                data.data?.readyState === 'ERROR') {
        // Update UI for error state
        setOptimisticStatus('ERROR')
        setOptimisticIsDeployed(false)
        
        toast({
          title: 'Deployment Failed',
          description: data.data.error || 'The deployment process encountered an error. Please try deploying again.',
          variant: 'destructive',
        })
        
        startTransition(() => {
          router.refresh()
        })
      } else {
        const status = data.data?.status || 'UNKNOWN'
        let statusMessage = 'The deployment is still in progress.'
        if (status === 'BUILDING') {
          statusMessage = 'The project is currently building. This may take a few minutes.'
          setOptimisticStatus('BUILDING')
        } else if (status === 'QUEUED') {
          statusMessage = 'The deployment is queued and will start shortly.'
          setOptimisticStatus('QUEUED')
        } else if (status === 'INITIALIZING') {
          statusMessage = 'The deployment is initializing.'
          setOptimisticStatus('INITIALIZING')
        }
        
        toast({
          title: 'Deployment in Progress',
          description: `${statusMessage} Please check again in a moment.`,
        })
      }
    } catch (error) {
      console.error('Error checking deployment status:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to check deployment status',
        variant: 'destructive',
      })
    } finally {
      setIsChecking(false)
    }
  }

  const handleDeploy = async () => {
    try {
      setIsDeploying(true)
      
      // Optimistically update UI
      setOptimisticStatus('DEPLOYING')
      setOptimisticIsDeployed(false)

      const response = await fetch(`/api/projects/${projectId}/deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deploymentType: 'production' }),
        cache: 'no-store'
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start deployment')
      }

      if (data.success) {
        toast({
          title: 'Deployment Started',
          description: 'Production deployment has started. Use the Check Status button to monitor progress.',
        })
        
        startTransition(() => {
          router.refresh()
        })
        
        // Start polling for updates
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch(`/api/projects/${projectId}/deployment-status`, {
            cache: 'no-store'
          })
          const statusData = await statusResponse.json()
          
          if (statusData.data?.status === 'READY' || statusData.data?.status === 'ERROR') {
            clearInterval(pollInterval)
            setOptimisticStatus(statusData.data.status)
            setOptimisticIsDeployed(statusData.data.status === 'READY')
            startTransition(() => {
              router.refresh()
            })
          }
        }, 3000) // Poll every 3 seconds
        
        // Clear interval after 5 minutes
        setTimeout(() => clearInterval(pollInterval), 300000)
      }
    } catch (error) {
      console.error('Deployment error:', error)
      setOptimisticStatus('ERROR')
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not start deployment',
        variant: 'destructive',
      })
    } finally {
      setIsDeploying(false)
    }
  }

  const currentStatus = optimisticStatus.toLowerCase()
  const showDeployButton = !optimisticIsDeployed && currentStatus !== 'deploying'
  const showRefreshButton = optimisticIsDeployed || currentStatus === 'deploying'

  return (
    <div className="flex items-center gap-4">
      {showDeployButton && (
        <Button
          onClick={handleDeploy}
          disabled={isDeploying || isPending}
        >
          {isDeploying ? (
            <>
              <Loading size={16} />
              <span className="ml-2">Starting Deployment...</span>
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Deploy to Production
            </>
          )}
        </Button>
      )}

      {showRefreshButton && (
        <Button
          onClick={checkDeploymentStatus}
          variant="outline"
          disabled={isChecking || isPending}
        >
          {isChecking ? (
            <>
              <Loading size={16} />
              <span className="ml-2">Checking Status...</span>
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Status
            </>
          )}
        </Button>
      )}
    </div>
  )
}

export default DeploymentButtons 