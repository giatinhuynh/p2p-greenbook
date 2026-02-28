import { X } from 'lucide-react'
import Image from 'next/image'
import React from 'react'
import { Button } from '../ui/button'
import { UploadDropzone } from '@/lib/uploadthing'

type Props = {
  onChange: (url?: string) => void
  value?: string
}

const FileUpload = ({ onChange, value }: Props) => {
  if (value) {
    return (
      <div className="flex flex-col justify-center items-center">
        <div className="relative w-40 h-40">
          <Image
            src={value}
            alt="company logo"
            className="object-contain"
            fill
          />
        </div>
        <Button
          onClick={() => onChange('')}
          variant="ghost"
          type="button"
        >
          <X className="h-4 w-4" />
          Remove Logo
        </Button>
      </div>
    )
  }
  return (
    <div className="w-full bg-muted/30">
      <UploadDropzone
        endpoint="companyLogo"
        onClientUploadComplete={(res) => {
          onChange(res?.[0].url)
        }}
        onUploadError={(error: Error) => {
          console.log(error)
        }}
      />
    </div>
  )
}

export default FileUpload