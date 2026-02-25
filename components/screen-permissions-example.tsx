'use client'

import { useCanViewScreen, useCanEditScreen } from '@/components/rbac-provider'
import { SCREENS } from '@/lib/screen-permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Example component showing how to use screen-level permissions
 */
export function ScreenPermissionsExample() {
  // Check if user can view/edit specific screens
  const canViewFiles = useCanViewScreen(SCREENS.FILES_LIST)
  const canUploadFiles = useCanEditScreen(SCREENS.FILES_UPLOAD)
  const canDeleteFiles = useCanEditScreen(SCREENS.FILES_DELETE)
  const canCreateCredentials = useCanEditScreen(SCREENS.CREDENTIALS_CREATE)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>File Operations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canViewFiles ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">You can view files</p>
              
              {canUploadFiles && (
                <Button>Upload File</Button>
              )}
              
              {canDeleteFiles && (
                <Button variant="destructive">Delete File</Button>
              )}
              
              {!canUploadFiles && !canDeleteFiles && (
                <p className="text-xs text-gray-500">View-only access</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-red-600">No access to files</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
        </CardHeader>
        <CardContent>
          {canCreateCredentials ? (
            <Button>Create New Credential</Button>
          ) : (
            <p className="text-sm text-gray-500">You cannot create credentials</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
