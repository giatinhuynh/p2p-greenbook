'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, FormProvider } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import FileUpload from '../global/file-upload'
import { Client } from '@prisma/client'
import { useToast } from '../ui/use-toast'
import { createClient } from '@/lib/queries'
import { useEffect, useState } from 'react'
import { useModal } from '@/providers/modal-provider'
import { useUser } from '@clerk/nextjs'
import { Loader2 } from 'lucide-react'

const formSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  companyEmail: z.string().email('Invalid email'),
  companyPhone: z.string().optional(),
  companyLogo: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
})

type FormData = z.infer<typeof formSchema>

interface ClientDetailsProps {
  details?: Partial<Client>
}

const ClientDetails: React.FC<ClientDetailsProps> = ({
  details,
}) => {
  const { toast } = useToast()
  const { setClose } = useModal()
  const router = useRouter()
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: details?.companyName || '',
      companyEmail: details?.companyEmail || '',
      companyPhone: details?.companyPhone || '',
      companyLogo: details?.companyLogo || '',
      address: details?.address || '',
      city: details?.city || '',
      state: details?.state || '',
      country: details?.country || '',
    },
  })

  async function onSubmit(values: FormData) {
    if (isSubmitting) return
    setIsSubmitting(true)
    
    try {
      if (!user) {
        throw new Error('Not authenticated')
      }

      if (details?.id) {
        // Update existing client
        const response = await fetch(`/api/clients/${details.id}/update`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: values.companyName,
            companyEmail: values.companyEmail,
            companyPhone: values.companyPhone,
            companyLogo: values.companyLogo,
            address: values.address,
            city: values.city,
            state: values.state,
            country: values.country,
          }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to update client');
        }

        form.reset(values);
        router.refresh();

        toast({
          title: 'Success',
          description: 'Client updated successfully',
        });
      } else {
        // Create new client
        const response = await createClient({
          ...values,
          createdById: user.id
        });
        
        if (!response) {
          throw new Error('Failed to create client');
        }

        toast({
          title: 'Success',
          description: 'Client created successfully',
        });
        setClose();
        router.refresh();
      }
    } catch (error) {
      console.error('Error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : `Could not ${details?.id ? 'update' : 'create'} client`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Client Information</CardTitle>
        <CardDescription>Please enter client business details</CardDescription>
      </CardHeader>
      <CardContent>
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              disabled={isSubmitting}
              control={form.control}
              name="companyLogo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Logo</FormLabel>
                  <FormControl>
                    <FileUpload
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex md:flex-row gap-4">
              <FormField
                disabled={isSubmitting}
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input
                        required
                        placeholder="Company name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex md:flex-row gap-4">
              <FormField
                disabled={isSubmitting}
                control={form.control}
                name="companyEmail"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Company Email</FormLabel>
                    <FormControl>
                      <Input
                        required
                        type="email"
                        placeholder="Email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                disabled={isSubmitting}
                control={form.control}
                name="companyPhone"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Company Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Phone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              disabled={isSubmitting}
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123 Business St..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex md:flex-row gap-4">
              <FormField
                disabled={isSubmitting}
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="City"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                disabled={isSubmitting}
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>State</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="State"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              disabled={isSubmitting}
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Country</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Country"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>{details?.id ? 'Updating...' : 'Creating...'}</span>
                </>
              ) : (
                details?.id ? 'Update Client' : 'Create Client'
              )}
            </Button>
          </form>
        </FormProvider>
      </CardContent>
    </Card>
  )
}

export default ClientDetails