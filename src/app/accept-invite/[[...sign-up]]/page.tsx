'use client'
import { useSearchParams } from 'next/navigation'
import { SignUp } from '@clerk/nextjs'
import React, { useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AcceptInvitePage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const invitedEmail = searchParams.get('email')
  const defaultName = invitedEmail ? invitedEmail.split('@')[0] : ''
  
  useEffect(() => {
    // Store token and email in session storage when the page loads with valid params
    if (token && invitedEmail) {
      sessionStorage.setItem('inviteToken', token)
      sessionStorage.setItem('invitedEmail', invitedEmail)
    }
    
    // If we're on verify-email page and don't have params, try to get from storage
    if (window.location.pathname.includes('verify-email')) {
      const storedToken = sessionStorage.getItem('inviteToken')
      const storedEmail = sessionStorage.getItem('invitedEmail')
      if (storedToken && storedEmail) {
        window.location.href = `/api/invites/accept?token=${storedToken}`
      }
    }
  }, [token, invitedEmail])

  if (!token || !invitedEmail) {
    // Try to get from storage if not in URL
    const storedToken = sessionStorage.getItem('inviteToken')
    const storedEmail = sessionStorage.getItem('invitedEmail')
    
    if (!storedToken || !storedEmail) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-destructive">Invalid Invitation Link</CardTitle>
              <CardDescription>
                This invitation link is invalid or has expired. Please contact the person who invited you for a new invitation.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      )
    }
  }

  const finalToken = token || sessionStorage.getItem('inviteToken') || ''
  const finalEmail = invitedEmail || sessionStorage.getItem('invitedEmail') || ''

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Complete Your Registration</CardTitle>
          <CardDescription className="text-base space-y-2">
            <p>You've been invited as a guest user. Please set up your account to access the client portal.</p>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignUp 
            path="/accept-invite"
            routing="path"
            redirectUrl={`/api/invites/accept?token=${finalToken}`}
            afterSignUpUrl={`/api/invites/accept?token=${finalToken}`}
            appearance={{
              elements: {
                formButtonPrimary: 'bg-primary hover:bg-primary/90',
                card: 'bg-transparent shadow-none',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton: 'hidden',
                dividerRow: 'hidden',
                formFieldLabel: 'text-foreground',
                formFieldInput: 'bg-background border-border',
                footerAction: 'hidden',
                formFieldAction: 'hidden', // Hide the edit email button
                identityPreviewEditButton: 'hidden' // Hide edit button in preview
              }
            }}
            initialValues={{ 
              emailAddress: finalEmail,
              firstName: defaultName
            }}
            unsafeMetadata={{
              skipEmailVerification: true,
              inviteToken: finalToken
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
} 