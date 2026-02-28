import { memo } from 'react'
import Loading from './loading'

interface LoadingPageProps {
  fullScreen?: boolean
  className?: string
}

const LoadingPage = memo(({ fullScreen = true, className = '' }: LoadingPageProps) => {
  return (
    <div 
      className={`flex justify-center items-center ${
        fullScreen ? 'h-screen w-screen' : 'h-full w-full'
      } ${className}`}
    >
      <Loading size={32} />
    </div>
  )
})

LoadingPage.displayName = 'LoadingPage'

export default LoadingPage
