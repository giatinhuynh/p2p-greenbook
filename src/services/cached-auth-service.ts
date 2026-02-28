import { cache } from 'react'
import { authService } from './auth-service'

export const getCachedCurrentUser = cache(async () => {
  return await authService.getCurrentUser()
})