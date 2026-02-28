'use client'
import { memo, useState } from 'react'
import { useToast } from '../ui/use-toast'
import { useRouter } from 'next/navigation'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Form validation schema
const formSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "USER", "GUEST"]).optional(),
})

type FormData = z.infer<typeof formSchema>

interface Props {
  userData?: {
    id?: string
    name?: string
    email?: string
    role?: "ADMIN" | "USER" | "GUEST"
    createdAt?: Date
    updatedAt?: Date
  }
  id?: string
  isNewUser?: boolean
}

const UserDetailsForm = memo(({ userData, id, isNewUser }: Props) => {
  const { toast } = useToast()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: userData?.name || '',
      email: userData?.email || '',
      role: userData?.role
    }
  })

  const onSubmit = async (values: FormData) => {
    if (isSubmitting || !id) return
    setIsSubmitting(true)
    
    try {
      console.log('Submitting form with values:', values)
      
      // Choose endpoint based on whether this is a new user or update
      const endpoint = isNewUser ? '/api/users/init' : `/api/user/${id}/update`
      const method = isNewUser ? 'POST' : 'PATCH'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          role: values.role
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const data = await response.json()
      console.log('Response:', data)

      form.reset(values)
      
      if (isNewUser) {
        router.push(`/user/${id}`)
      } else {
        router.refresh()
      }

      toast({
        title: 'Success',
        description: isNewUser ? 'Your profile has been created.' : 'Your profile has been updated.',
      })
    } catch (error) {
      console.error('Error:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not update profile',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isNewUser ? 'Complete Your Profile' : 'Profile Settings'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly disabled={isSubmitting} />
                  </FormControl>
                  <FormDescription>
                    Email cannot be changed.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-center">
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="w-[150px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  isNewUser ? 'Create Profile' : 'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  )
})

UserDetailsForm.displayName = 'UserDetailsForm'

export default UserDetailsForm