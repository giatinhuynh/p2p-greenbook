'use client'
import { Client, Project, User } from '@prisma/client'
import { createContext, useContext, useEffect, useState, useCallback, memo } from 'react'

interface ModalProviderProps {
  children: React.ReactNode
}

type ModalData = {
  user?: User
  client?: Client
  project?: Project
}

type FetchDataFunction = () => Promise<Partial<ModalData>>

type ModalContextType = {
  data: ModalData
  isOpen: boolean
  setOpen: (modal: React.ReactNode, fetchData?: FetchDataFunction) => void
  setClose: () => void
}

export const ModalContext = createContext<ModalContextType>({
  data: {},
  isOpen: false,
  setOpen: () => {},
  setClose: () => {}
})

// Memoize the modal content
const ModalContent = memo(({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
})

ModalContent.displayName = 'ModalContent'

const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState<ModalData>({})
  const [showingModal, setShowingModal] = useState<React.ReactNode>(null)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const setOpen = useCallback(async (
    modal: React.ReactNode,
    fetchData?: FetchDataFunction
  ) => {
    if (modal) {
      if (fetchData) {
        const newData = await fetchData()
        setData(prevData => ({ ...prevData, ...newData }))
      }
      setShowingModal(modal)
      setIsOpen(true)
    }
  }, [])

  const setClose = useCallback(() => {
    setIsOpen(false)
    setData({})
  }, [])

  const contextValue = {
    data,
    isOpen,
    setOpen,
    setClose
  }

  if (!isMounted) return null

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      <ModalContent>{showingModal}</ModalContent>
    </ModalContext.Provider>
  )
}

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

export default memo(ModalProvider)