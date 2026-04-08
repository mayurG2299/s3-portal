"use client"

import React from 'react'

interface DebugSessionClientProps {
  session: any
}

export default function DebugSessionClient({ session }: DebugSessionClientProps) {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold">Debug Session Info</h1>
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-semibold mb-4">Current Session</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
      <div className="bg-white p-6 rounded-lg border">
        <h2 className="text-xl font-semibold mb-4">User Info</h2>
        <ul className="space-y-2">
          <li><strong>ID:</strong> {session.user.id}</li>
          <li><strong>Email:</strong> {session.user.email}</li>
          <li><strong>Role ID:</strong> {session.user.roleId || 'NOT SET'}</li>
          <li><strong>Team ID:</strong> {session.user.teamId || 'NOT SET'}</li>
        </ul>
      </div>
      {(!session.user.roleId || !session.user.teamId) && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Your user is missing a role or team assignment. You need to:</p>
                <ol className="list-decimal ml-5 mt-2 space-y-1">
                  <li>Check Prisma Studio at <a href="http://localhost:5555" target="_blank" className="underline">localhost:5555</a></li>
                  <li>Find your user in the User table</li>
                  <li>Make sure you have a TeamMember record with a role assigned</li>
                  <li>Log out and log back in after fixing</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}