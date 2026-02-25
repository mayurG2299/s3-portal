'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import type { Role, ScreenName } from '@prisma/client'

interface RBACContextType {
  userId: string | null
  role: Role | null
  teamId: string | null
  hasRoleLevel: (requiredLevel: number) => boolean
  isOwner: boolean
  isAdmin: boolean
  isViewer: boolean
  loading: boolean
  
  // Screen/Feature permissions
  canViewScreen: (screenName: ScreenName) => boolean
  canEditScreen: (screenName: ScreenName) => boolean
  screenPermissions: Map<ScreenName, 'VIEW' | 'EDIT'> | null
  loadingScreenPermissions: boolean
  loadingRole: boolean
}

const RBACContext = createContext<RBACContextType | undefined>(undefined)

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const loading = status === 'loading'

  const roleId = session?.user?.roleId
  const userId = session?.user?.id || null
  const teamId = session?.user?.teamId || null

  const [role, setRole] = useState<Role | null>(null)
  const [loadingRole, setLoadingRole] = useState(false)
  const [screenPermissions, setScreenPermissions] = useState<Map<ScreenName, 'VIEW' | 'EDIT'> | null>(null)
  const [loadingScreenPermissions, setLoadingScreenPermissions] = useState(false)

  // Fetch role object when roleId changes
  useEffect(() => {
    if (!roleId) {
      setRole(null)
      return
    }

    const fetchRole = async () => {
      setLoadingRole(true)
      try {
        const response = await fetch(`/api/roles/${roleId}`)
        if (response.ok) {
          const data = await response.json()
          setRole(data)
        }
      } catch (error) {
        console.error('Failed to fetch role:', error)
      } finally {
        setLoadingRole(false)
      }
    }

    fetchRole()
  }, [roleId])

  // Fetch screen permissions when user/team changes
  useEffect(() => {
    if (!userId || !teamId) {
      setScreenPermissions(null)
      return
    }

    const fetchScreenPermissions = async () => {
      setLoadingScreenPermissions(true)
      try {
        const response = await fetch(`/api/permissions/screens?teamId=${teamId}`)
        if (response.ok) {
          const data = await response.json()
          const permMap = new Map<ScreenName, 'VIEW' | 'EDIT'>()
          
          data.forEach((perm: any) => {
            permMap.set(perm.screenName, perm.permissionLevel)
          })
          
          setScreenPermissions(permMap)
        }
      } catch (error) {
        console.error('Failed to fetch screen permissions:', error)
      } finally {
        setLoadingScreenPermissions(false)
      }
    }

    fetchScreenPermissions()
  }, [userId, teamId])

  const canViewScreen = (screenName: ScreenName): boolean => {
    if (!screenPermissions) return false
    const permission = screenPermissions.get(screenName)
    return permission === 'VIEW' || permission === 'EDIT'
  }

  const canEditScreen = (screenName: ScreenName): boolean => {
    if (!screenPermissions) return false
    return screenPermissions.get(screenName) === 'EDIT'
  }

  const value: RBACContextType = {
    userId,
    role,
    teamId,
    hasRoleLevel: (requiredLevel: number) => (role?.level || 0) >= requiredLevel,
    isOwner: role?.level === 100 || role?.name === 'OWNER',
    isAdmin: (role?.level || 0) >= 50,
    isViewer: (role?.level || 0) >= 10,
    loading,
    
    // Screen permissions
    canViewScreen,
    canEditScreen,
    screenPermissions,
    loadingScreenPermissions,
    loadingRole,
  }

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>
}

/**
 * Hook to access RBAC context
 * Must be used within RBACProvider
 */
export function useRBAC() {
  const context = useContext(RBACContext)
  if (context === undefined) {
    throw new Error('useRBAC must be used within RBACProvider')
  }
  return context
}

/**
 * Hook to check screen permission (view/edit)
 */
export function useScreenPermission(screenName: ScreenName, level: 'VIEW' | 'EDIT' = 'VIEW') {
  const rbac = useRBAC()
  
  if (level === 'EDIT') {
    return rbac.canEditScreen(screenName)
  }
  
  return rbac.canViewScreen(screenName)
}

/**
 * Hook to check if user can view screen
 */
export function useCanViewScreen(screenName: ScreenName): boolean {
  const { canViewScreen } = useRBAC()
  return canViewScreen(screenName)
}

/**
 * Hook to check if user can edit screen
 */
export function useCanEditScreen(screenName: ScreenName): boolean {
  const { canEditScreen } = useRBAC()
  return canEditScreen(screenName)
}

/**
 * HOC to protect components by screen permission
 */
export function withScreenGuard(
  Component: React.ComponentType<any>,
  screenName: ScreenName,
  level: 'VIEW' | 'EDIT' = 'VIEW',
  fallback?: React.ReactNode
) {
  return function ProtectedComponent(props: any) {
    const rbac = useRBAC()

    if (rbac.loading || rbac.loadingScreenPermissions) {
      return <div>Loading...</div>
    }

    const hasPermission = level === 'EDIT' ? rbac.canEditScreen(screenName) : rbac.canViewScreen(screenName)

    if (!hasPermission) {
      return fallback || <div>Access Denied</div>
    }

    return <Component {...props} />
  }
}
