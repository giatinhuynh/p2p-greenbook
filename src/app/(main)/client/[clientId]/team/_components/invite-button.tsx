'use client'
import React from 'react'
import CustomModal from '@/components/global/custom-modal'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { addUserToClient } from '@/lib/server-actions'
import { useModal } from '@/providers/modal-provider'
import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import Loading from '@/components/global/loading'

const formSchema = z.object({
  email: z.string().email('Invalid email address')
})

type FormData = z.infer<typeof formSchema>

interface Props {
  clientId: string
}

const InviteButton = ({ clientId }: Props) => {
  const { setOpen } = useModal()
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = React.useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: ''
    }
  })

  async function onSubmit(values: FormData) {
    try {
      setLoading(true)
      const response = await addUserToClient(clientId, values.email)
      
      if (response) {
        form.reset()
        setOpen(false)
        toast({
          title: 'Invitation Sent',
          description: `An invitation email has been sent to ${values.email}`,
          variant: 'default'
        })
        router.refresh()
      }
    } catch (error) {
      console.error('Error inviting user:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send invitation'
      })
    } finally {
      setLoading(false)
    }
  }

  const openModal = () => {
    setOpen(
      <CustomModal
        title="Invite Team Member"
        subheading="Invite a new guest member to your client's team"
      >
        <div className="mt-4">
          {loading ? (
            <Loading />
          ) : (
            <Form
              form={form}
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="guest@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button 
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </div>
            </Form>
          )}
        </div>
      </CustomModal>
    )
  }

  return (
    <Button onClick={openModal}>
      <UserPlus className="h-4 w-4 mr-2" />
      Invite Member
    </Button>
  )
}

export default InviteButton
