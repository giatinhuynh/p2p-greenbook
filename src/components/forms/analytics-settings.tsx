'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  Form,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'
import { useState, useEffect } from 'react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

const formSchema = z.object({
  // Google Analytics Configuration
  gaPropertyId: z.string().min(1, "Google Analytics Measurement ID is required"),
});

type AnalyticsConfig = z.infer<typeof formSchema>

interface AnalyticsSettingsProps {
  projectId: string
  initialConfig?: Partial<AnalyticsConfig>
}

export function AnalyticsSettings({ projectId, initialConfig }: AnalyticsSettingsProps) {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const form = useForm<AnalyticsConfig>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      gaPropertyId: '',
      ...initialConfig,
    },
  })

  useEffect(() => {
    async function loadConfig() {
      if (!projectId) return
      
      try {
        setIsLoading(true)
        const response = await fetch(`/api/projects/${projectId}/analytics/config`)
        
        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'Unknown error' }));
          
          if (response.status === 403) {
            toast({
              variant: 'destructive',
              title: 'Access Denied',
              description: 'You do not have permission to view analytics settings for this project. Please contact your project administrator.',
            })
            return
          }
          
          if (response.status === 404) {
            // If config doesn't exist yet, use default values
            const defaultValues = {
              gaPropertyId: '',
            }
            form.reset(defaultValues)
            return
          }

          throw new Error(data.error || 'Failed to load analytics configuration')
        }
        
        const config = await response.json()
        form.reset(config)
      } catch (error) {
        console.error('Error loading analytics config:', error)
        toast({
          variant: 'destructive',
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to load analytics configuration',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (!initialConfig) {
      loadConfig()
    }
  }, [projectId, initialConfig, form, toast])

  async function onSubmit(values: AnalyticsConfig) {
    if (!projectId) return;
    
    try {
      setIsSaving(true);
      console.log('[Analytics Settings] Starting form submission with values:', values);

      const apiUrl = `/api/projects/${projectId}/analytics/config`;
      console.log('[Analytics Settings] Making API request to:', apiUrl);
      
      const payload = {
        ...values,
        gaEnabled: true,
      };
      
      console.log('[Analytics Settings] Request payload:', payload);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('[Analytics Settings] Response status:', response.status);
      
      const data = await response.json();
      console.log('[Analytics Settings] Response data:', data);

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(data.detail || 'You do not have permission to modify analytics settings');
        }
        throw new Error(data.error || 'Failed to save analytics configuration');
      }

      toast({
        title: 'Success',
        description: 'Analytics configuration saved successfully',
      });

      form.reset(data);
    } catch (error) {
      console.error('[Analytics Settings] Error saving config:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save analytics configuration',
      });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Analytics Settings</CardTitle>
          <CardDescription>Loading configuration...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Analytics Settings</CardTitle>
        <CardDescription>Configure analytics tracking for your project</CardDescription>
      </CardHeader>
      <CardContent>
        <Form 
          form={form} 
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <div className="space-y-6">
            <h3 className="text-lg font-medium">Google Analytics Configuration</h3>
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-md mb-4">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Important:</strong> You need to use the numeric Property ID (not the Measurement ID that starts with "G-") 
                for the Google Analytics Data API integration.
              </p>
            </div>
            <FormField
              control={form.control}
              name="gaPropertyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter your numeric GA4 Property ID (e.g., 123456789)"
                      disabled={isSaving}
                    />
                  </FormControl>
                  <FormDescription>
                    <p>The numeric Google Analytics 4 Property ID found in your GA4 Admin settings:</p>
                    <ol className="list-decimal ml-5 mt-2 text-xs space-y-1">
                      <li>Go to <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Google Analytics</a></li>
                      <li>Click on Admin (gear icon in bottom left)</li>
                      <li>Select your property</li>
                      <li>Look for the numeric "Property ID" in Property Settings</li>
                    </ol>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-4">
              <p className="text-sm text-gray-500">
                <strong>Note:</strong> Make sure to grant access to our service account email 
                (<code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-xs">greenbook@greenbook-451009.iam.gserviceaccount.com</code>) 
                in your Google Analytics property settings under "Account Access Management".
              </p>
            </div>

            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </Button>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  )
} 