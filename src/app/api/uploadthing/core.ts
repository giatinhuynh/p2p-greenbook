import { createUploadthing, type FileRouter } from 'uploadthing/next'
import { auth } from '@clerk/nextjs/server'

const f = createUploadthing()

const authenticateUser = () => {
  const user = auth()
  if (!user) throw new Error('Unauthorized')
  return user
}

export const ourFileRouter = {
  companyLogo: f({ image: { maxFileSize: '4MB', maxFileCount: 1 } })
    .middleware(authenticateUser)
    .onUploadComplete(() => {}),
} satisfies FileRouter

export type OurFileRouter = typeof ourFileRouter
