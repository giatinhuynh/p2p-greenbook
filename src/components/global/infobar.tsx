'use client'
import { UserButton } from '@clerk/nextjs'
import React from 'react'
import { twMerge } from 'tailwind-merge'
import { ModeToggle } from './mode-toggle'

type InfoBarProps = {
  className?: string;
  role?: string;
  clientId?: string;
}

const InfoBar = ({ className }: InfoBarProps) => {
  return (
    <div
      className={twMerge(
        'fixed z-[20] md:left-[300px] left-0 right-0 top-0 p-4 bg-background/80 backdrop-blur-md flex gap-4 items-center border-b-[1px]',
        className
      )}
    >
      <div className="flex items-center gap-2 ml-auto">
        <UserButton afterSignOutUrl="/" />
        <ModeToggle />
      </div>
    </div>
  )
}

export default InfoBar