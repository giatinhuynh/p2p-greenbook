'use client'
import CustomModal from '@/components/global/custom-modal'
import { Button } from '@/components/ui/button'
import { useModal } from '@/providers/modal-provider'
import { PlusCircleIcon } from 'lucide-react'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import ProjectDetails from '@/components/forms/project-details'

type Props = {
  clientId: string
  className?: string
}

const CreateProjectButton = ({ className, clientId }: Props) => {
  const { setOpen } = useModal()

  return (
    <Button
      className={twMerge('w-full flex gap-4', className)}
      onClick={() => {
        setOpen(
          <CustomModal
            title="Create a Project"
            subheading="Add a new project to this client"
          >
            <ProjectDetails clientId={clientId} />
          </CustomModal>
        )
      }}
    >
      <PlusCircleIcon size={15} />
      Create Project
    </Button>
  )
}

export default CreateProjectButton