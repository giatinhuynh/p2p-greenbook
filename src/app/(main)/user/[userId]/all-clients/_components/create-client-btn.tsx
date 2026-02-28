'use client'
import ClientDetails from '@/components/forms/client-details'
import CustomModal from '@/components/global/custom-modal'
import { Button } from '@/components/ui/button'
import { useModal } from '@/providers/modal-provider'
import { PlusCircleIcon } from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'

type Props = {
  className?: string
}

const CreateClientButton = ({ className }: Props) => {
  const { setOpen } = useModal()

  return (
    <Button
      className={twMerge('w-full flex gap-4', className)}
      onClick={() => {
        setOpen(
          <CustomModal
            title="Create a Client"
            subheading="Add a new client to your dashboard"
          >
            <ClientDetails />
          </CustomModal>
        )
      }}
    >
      <PlusCircleIcon size={15} />
      Create Client
    </Button>
  )
}

export default CreateClientButton