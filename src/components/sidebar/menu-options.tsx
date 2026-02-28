'use client'

import { Client } from '@prisma/client'
import React, { useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { Button } from '../ui/button'
import { Menu, ArrowLeft } from 'lucide-react'
import clsx from 'clsx'
import Image from 'next/image'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '../ui/command'
import Link from 'next/link'
import { Separator } from '../ui/separator'
import { icons } from '@/lib/constants'
import { ProjectWithDetails, UserDetails, SidebarContent, MenuOption } from '@/lib/types'
import { useRouter } from 'next/navigation'

type Props = {
  defaultOpen?: boolean
  details: UserDetails
  sidebarContent: SidebarContent
  sidebarOpt: MenuOption[]
  clients: Array<{
    client: Client & { projects: ProjectWithDetails[] }
    role: string
  }>
}

const MenuOptions = ({
  sidebarContent,
  sidebarOpt,
  defaultOpen,
  details,
  clients,
}: Props) => {
  const [isMounted, setIsMounted] = useState(false)
  const router = useRouter()

  const openState = useMemo(
    () => (defaultOpen ? { open: true } : {}),
    [defaultOpen]
  )

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  // Get back link based on type
  const getBackLink = () => {
    if (details.type === 'client') {
      // Check for admin access via sidebar options (admin users have Settings)
      const hasAdminAccess = sidebarOpt.some(opt => opt.name === 'Settings')
      // Check for regular user access via clients array
      const clientRole = clients.find(c => c.client.id === details.id)?.role
      const isRegularUser = clientRole && clientRole !== 'GUEST'
      
      // Show back button for both admin and regular users
      if (hasAdminAccess || isRegularUser) {
        // Extract user ID from the first sidebar option which always contains the user ID
        const userId = sidebarOpt[0]?.link.split('/')[2]
        return userId ? `/user/${userId}` : null
      }
      return null
    }
    if (details.type === 'project') {
      // Extract client ID from the current sidebar options
      const clientId = sidebarOpt[0]?.link.split('/')[2]
      return clientId ? `/client/${clientId}` : null
    }
    return null
  }

  const backLink = getBackLink()

  return (
    <Sheet modal={false} {...openState}>
      {/* Sheet Trigger */}
      <SheetTrigger asChild>
        <div className="absolute left-4 top-4 z-[100] md:hidden flex">
          <Button variant="outline" size="icon">
            <Menu />
          </Button>
        </div>
      </SheetTrigger>

      {/* Sheet Content */}
      <SheetContent
        showX={!defaultOpen}
        side="left"
        className={clsx(
          'bg-background/80 backdrop-blur-xl fixed top-0 border-r-[1px] p-6',
          {
            'hidden md:inline-block z-0 w-[300px]': defaultOpen,
            'inline-block md:hidden z-[100] w-full': !defaultOpen,
          }
        )}
      >
        {/* Sidebar Logo with centered text */}
        <div className="flex flex-col items-center mb-10">
          {sidebarContent.type === 'text' ? (
            <span className="text-3xl font-bold">{sidebarContent.content}</span>
          ) : (
            <div className="relative w-40 h-40">
              <Image
                src={sidebarContent.content}
                alt="logo"
                className="object-contain"
                fill
              />
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <div className="mt-8">
          <p className="text-muted-foreground text-xs mb-2">MENU LINKS</p>
          <Separator className="mb-4" />
          <nav>
            <Command>
              <CommandList>
                <CommandGroup>
                  {sidebarOpt.map((option) => {
                    const Icon = icons.find((icon) => icon.value === option.icon)?.path
                    return (
                      <CommandItem key={option.id}>
                        <Link href={option.link} className="flex items-center gap-2 w-full">
                          {Icon && <Icon />}
                          <span>{option.name}</span>
                        </Link>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </nav>
        </div>

        {/* Back Button */}
        {backLink && (
          <div className="absolute bottom-6 left-6 right-6">
            <Button 
              variant="outline" 
              className="w-full flex items-center gap-2"
              onClick={() => router.push(backLink)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export default MenuOptions