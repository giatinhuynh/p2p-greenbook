'use client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { removeUserFromClient } from '@/lib/server-actions'
import { UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React from 'react'

type Props = {
  clientId: string
  userId: string
  userName: string
}

const RemoveButton = ({ clientId, userId, userName }: Props) => {
  const { toast } = useToast()
  const router = useRouter()

  const handleRemove = async () => {
    try {
      await removeUserFromClient(clientId, userId)
      toast({
        title: 'Success',
        description: 'Team member removed successfully'
      })
      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not remove team member'
      })
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <UserMinus className="h-4 w-4 text-muted-foreground" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove {userName} from this client? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove}>Remove</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default RemoveButton
