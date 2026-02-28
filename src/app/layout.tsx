import './globals.css'
import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/providers/theme-provider'
import ModalProvider from '@/providers/modal-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnarToaster } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'

const font = DM_Sans({ subsets: ['latin'] })

// Add at the top of the file
if (typeof process !== 'undefined') {
  process.setMaxListeners(20)
}

export const metadata: Metadata = {
  title: 'GreenBook',
  description: 'Sustainable Digital Brochures',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("min-h-screen bg-background font-sans antialiased", font.className)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClerkProvider>
            <ModalProvider>
              {children}
              <Toaster />
              <SonnarToaster position="bottom-left" />
            </ModalProvider>
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}