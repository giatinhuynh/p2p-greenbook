'use client'

import React, { useState, useEffect } from 'react'
import { useSignIn } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { FcGoogle } from 'react-icons/fc'
import { Separator } from '@/components/ui/separator'
import { SignIn } from "@clerk/nextjs"

const validateEmailWithServer = async (email: string) => {
  const response = await fetch('/api/validate-email', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim().toLowerCase() })
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Server error response:', errorText)
    throw new Error('Failed to validate email')
  }

  const contentType = response.headers.get('content-type')
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text()
    console.error('Unexpected response type:', contentType, 'Response:', text)
    throw new Error('Invalid server response')
  }

  return response.json()
}

const LoadingScreen = () => (
  <div 
    className="fixed inset-0 bg-background flex items-center justify-center" 
    style={{ 
      zIndex: 9999,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 1,
      transition: 'opacity 0.2s'
    }}
  >
    <div className="flex flex-col items-center gap-2 p-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <h3 className="font-semibold text-xl">Signing you in...</h3>
      <p className="text-muted-foreground text-sm">Please wait while we redirect you</p>
    </div>
  </div>
)


const Page = () => {
  const [step, setStep] = useState<'select' | 'guest' | 'employee-check' | 'employee'>('select')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const { isLoaded, signIn, setActive } = useSignIn()
  const router = useRouter()

  useEffect(() => {
    // Prefetch the user page to speed up navigation
    router.prefetch('/user');
  }, [router]);

  const validateEmail = (email: string) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(email)
  }

  const handleEmployeeEmailCheck = async () => {
    console.log('Starting email validation for:', email)
    
    if (!email) {
      console.log('Email is empty')
      setError('Email is required')
      return
    }

    if (!validateEmail(email)) {
      console.log('Invalid email format:', email)
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('Sending validation request')
      const data = await validateEmailWithServer(email)
      console.log('Validation response:', data)

      if (data.exists) {
        console.log('Valid employee email, proceeding to login')
        setStep('employee')
      } else if (data.isApprovedEmployee) {
        console.log('Approved employee without account, redirecting to sign-up')
        // Store the email in the URL to pre-fill it in the sign-up form
        router.push(`/user/sign-up?email=${encodeURIComponent(email)}`)
      } else {
        console.log('Invalid employee email:', data)
        setError(data.message || 'Email not found in our system')
      }
    } catch (error) {
      console.error('Validation error:', error)
      setError(error instanceof Error 
        ? error.message 
        : 'Failed to validate email. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleRedirect = async (url: string) => {
    setIsRedirecting(true)
    // Ensure loading screen is visible before redirect
    await new Promise(resolve => setTimeout(resolve, 50))
    router.replace(url)
  }

  const handleGuestSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    setIsLoading(true)
    setError('')

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === "complete") {
        setIsRedirecting(true)
        setIsLoading(false)
        
        await setActive({ session: result.createdSessionId })
        
        try {
          const [roleResponse] = await Promise.all([
            fetch('/api/user/role'),
            new Promise(resolve => setTimeout(resolve, 100))
          ])

          if (!roleResponse.ok) {
            throw new Error('Failed to fetch user role')
          }
          const roleData = await roleResponse.json()
          
          if (roleData.role === 'ADMIN' || roleData.role === 'USER') {
            await handleRedirect("/user")
          } else if (roleData.role === 'GUEST') {
            const clientResponse = await fetch(`/api/user/${roleData.userId}/client`)
            if (!clientResponse.ok) {
              throw new Error('Failed to fetch client information')
            }
            const clientData = await clientResponse.json()
            
            if (clientData.clientId) {
              await handleRedirect(`/client/${clientData.clientId}`)
            } else {
              throw new Error('Unable to access client portal. Please contact support.')
            }
          } else {
            throw new Error('Unable to determine user access. Please contact support.')
          }
        } catch (error) {
          setIsRedirecting(false)
          setError(error instanceof Error ? error.message : 'An error occurred during redirect')
        }
      }
    } catch (err: any) {
      console.error("Sign in error:", err)
      setError(err.message || err.errors?.[0]?.message || "An error occurred during sign in")
      setIsRedirecting(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!isLoaded) return

    try {
      setIsRedirecting(true) // Show loading screen before redirect
      
      // Prefetch potential redirect paths
      router.prefetch('/user')
      router.prefetch('/sso-callback')
      
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/user",
      })
    } catch (err: any) {
      console.error("Google sign in error:", err)
      setError(err.errors?.[0]?.message || "An error occurred during sign in")
      setIsRedirecting(false)
    }
  }

  const checkUserAccess = async () => {
    try {
      const roleResponse = await fetch('/api/user/role')
      if (!roleResponse.ok) {
        throw new Error('Failed to fetch user role')
      }
      
      const roleData = await roleResponse.json()
      
      if (roleData.role === 'ADMIN' || roleData.role === 'USER') {
        router.push("/user")
        return true
      } else {
        console.error('Invalid role for employee access:', roleData.role)
        setError('You do not have employee access. Please contact support.')
        return false
      }
    } catch (err) {
      console.error("Access check error:", err)
      setError("Failed to verify access. Please try again.")
      return false
    }
  }

  const handleEmployeeSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isLoaded) return

    setIsLoading(true)
    setError('')

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      })

      if (result.status === "complete") {
        setIsRedirecting(true)
        setIsLoading(false) // Turn off the loading spinner
        
        // Set the session immediately
        await setActive({ session: result.createdSessionId })
        
        // Prefetch the destination
        router.prefetch('/user')
        
        try {
          // Small delay to ensure session is active
          await new Promise(resolve => setTimeout(resolve, 100))
          
          const hasAccess = await checkUserAccess()
          if (hasAccess) {
            router.replace('/user')
          } else {
            throw new Error('You do not have employee access. Please contact support.')
          }
        } catch (error) {
          setIsRedirecting(false)
          setError(error instanceof Error ? error.message : 'An error occurred during redirect')
        }
      } else {
        setError("Failed to sign in. Please check your credentials.")
      }
    } catch (err: any) {
      console.error("Sign in error:", err)
      if (err.errors?.[0]?.code === 'form_password_incorrect') {
        setError("Invalid password. If you signed up with Google, please use the Google sign-in option.")
      } else {
        setError(err.errors?.[0]?.message || "An error occurred during sign in")
      }
      setIsRedirecting(false)
    } finally {
      setIsLoading(false)
    }
  }

  const renderContent = () => {
    switch (step) {
      case 'select':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
              <CardDescription>Choose how you want to sign in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full" 
                variant="outline"
                onClick={() => setStep('guest')}
                disabled={isLoading || isRedirecting}
              >
                Sign in as Guest
              </Button>
              <Button 
                className="w-full"
                onClick={() => setStep('employee-check')}
                disabled={isLoading || isRedirecting}
              >
                Sign in as Employee
              </Button>
            </CardContent>
          </Card>
        )

      case 'employee-check':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Employee Verification</CardTitle>
              <CardDescription>Enter your work email to continue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleEmployeeEmailCheck()}
                  disabled={isLoading || isRedirecting}
                  className={error ? 'border-destructive' : ''}
                />
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              <Button 
                className="w-full"
                onClick={handleEmployeeEmailCheck}
                disabled={isLoading || isRedirecting}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>
              <Button 
                className="w-full"
                variant="outline"
                onClick={() => {
                  setStep('select')
                  setError('')
                  setEmail('')
                }}
                disabled={isLoading || isRedirecting}
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )

      case 'guest':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Guest Sign In</CardTitle>
              <CardDescription>Sign in to access your client portal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGuestSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setError('')
                    }}
                    disabled={isLoading || isRedirecting}
                    className={error ? 'border-destructive' : ''}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    disabled={isLoading || isRedirecting}
                    className={error ? 'border-destructive' : ''}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button 
                  type="submit"
                  className="w-full"
                  disabled={isLoading || isRedirecting}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>

                <Button 
                  className="w-full"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setStep('select')
                    setError('')
                    setEmail('')
                    setPassword('')
                  }}
                  disabled={isLoading || isRedirecting}
                >
                  Back
                </Button>
              </form>
            </CardContent>
          </Card>
        )

      case 'employee':
        return (
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">Employee Sign In</CardTitle>
              <CardDescription>Welcome back, {email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full h-11 font-normal"
                variant="outline"
                onClick={handleGoogleSignIn}
                disabled={isLoading || isRedirecting}
              >
                <FcGoogle className="mr-2 h-5 w-5" />
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <Separator className="w-full" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with password
                  </span>
                </div>
              </div>

              <form onSubmit={handleEmployeeSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    disabled={isLoading || isRedirecting}
                    className={error ? 'border-destructive' : ''}
                  />
                </div>

                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}

                <Button 
                  type="submit"
                  className="w-full"
                  disabled={isLoading || isRedirecting}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in with Password'
                  )}
                </Button>
              </form>

              <Button 
                className="w-full"
                variant="outline"
                type="button"
                onClick={() => {
                  setStep('select')
                  setError('')
                  setEmail('')
                  setPassword('')
                }}
                disabled={isLoading || isRedirecting}
              >
                Back
              </Button>
            </CardContent>
          </Card>
        )

      default:
        return (
          <SignIn
            afterSignInUrl={'/user'}
            redirectUrl={'/user'}
            appearance={{
              elements: {
                rootBox: "mx-auto",
                card: "shadow-none",
              },
            }}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {(isLoading || isRedirecting) && <LoadingScreen />}
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          opacity: isRedirecting ? 0 : 1,
          transition: 'opacity 0.2s',
          visibility: isRedirecting ? 'hidden' : 'visible'
        }}
      >
        {renderContent()}
      </div>
    </div>
  )
}

export default Page