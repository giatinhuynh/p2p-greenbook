import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { getAuthUserDetails, getAllClients } from '@/lib/queries'
import { ProjectStatus, Role } from '@prisma/client'
import Image from 'next/image'
import Link from 'next/link'
import React from 'react'
import DeleteButton from './_components/delete-button'
import CreateClientButton from './_components/create-client-btn'
import { CalendarDays, MapPin } from 'lucide-react'
import { Mail } from 'lucide-react'
import { Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import BlurPage from '@/components/global/blur-page'

type ClientWithRole = {
  id: string;
  role: Role | string;
  companyName: string;
  companyEmail: string;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
  companyLogo: string | null;
  createdById: string;
  clientUsers?: {
    id: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
    clientId: string;
    userId: string;
  }[];
  projects?: {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    clientId: string;
    description: string | null;
    repositoryUrl: string | null;
    deploymentUrl: string | null;
    status: ProjectStatus;
  }[];
}

const AllClientsPage = async () => {
  const user = await getAuthUserDetails()
  if (!user) return null

  // Get all clients based on user role
  const accessibleClients = user.role === Role.GUEST
    ? user.clientUsers.map(cu => ({
        ...cu.client,
        role: cu.role
      }))
    : (await getAllClients()).map(client => ({
        ...client,
        role: user.role // Set role based on user's role for non-guest users
      }))

  return (
    <BlurPage>
      <div className="flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-4xl font-bold">Clients</h1>
          <CreateClientButton
            className="w-[200px]"
          />
        </div>
        <Command className="rounded-lg bg-transparent">
          <CommandInput placeholder="Search Clients..." />
          <CommandList>
            <CommandEmpty>No Clients Found.</CommandEmpty>
            <CommandGroup heading="Clients">
              {accessibleClients?.length > 0 ? (
                accessibleClients.map((client: ClientWithRole) => (
                  <CommandItem
                    key={client.id}
                    className="h-auto !bg-background my-2 text-foreground border-[1px] border-border p-6 rounded-lg hover:!bg-background/50 cursor-pointer transition-all"
                  >
                    <div className="flex flex-col gap-4 w-full h-full">
                      <div className="flex justify-between items-start w-full">
                        <Link
                          href={`/client/${client.id}`}
                          className="flex gap-4"
                        >
                          <div className="relative w-16 h-16">
                            <Image
                              src={client.companyLogo || '/assets/default-company.svg'}
                              alt="client logo"
                              fill
                              className="rounded-md object-contain bg-muted/50 p-2"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <h3 className="font-semibold text-lg text-foreground">{client.companyName}</h3>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Mail className="h-4 w-4" />
                              <span>{client.companyEmail}</span>
                            </div>
                            {client.address && (
                              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                                <MapPin className="h-4 w-4" />
                                <span>{client.address}</span>
                              </div>
                            )}
                          </div>
                        </Link>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <Badge className={
                              client.role && (client.role === 'USER' || client.role === 'ADMIN')
                                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                : 'bg-muted text-muted-foreground'
                            }>
                              {client.role ? client.role.toLowerCase() : 'guest'}
                            </Badge>
                            {client.role && (client.role === 'USER' || client.role === 'ADMIN') && (
                              <DeleteButton 
                                clientId={client.id} 
                                clientName={client.companyName} 
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground text-sm">
                            <CalendarDays className="h-4 w-4" />
                            <span>
                              Created {new Date(client.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))
              ) : (
                <div className="text-muted-foreground text-center p-4">
                  No Clients
                </div>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </div>
    </BlurPage>
  )
}

export default AllClientsPage

