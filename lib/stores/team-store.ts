import { create } from 'zustand'

export interface TeamSummary {
  id: string
  name: string
  slug: string
}

export interface TeamInvitation {
  id: string
  email: string
  expiresAt: string
  createdAt: string
  team: { id: string; name: string; slug: string }
  role: { id: string; name: string; description: string | null }
  invitedBy: { name: string | null; email: string }
}

interface TeamStoreState {
  currentTeamId: string | null
  teams: TeamSummary[]
  invitations: TeamInvitation[]
  removedTeamId: string | null
  removalModalOpen: boolean
  setCurrentTeamId: (teamId: string | null) => void
  setTeams: (teams: TeamSummary[]) => void
  setInvitations: (invitations: TeamInvitation[]) => void
  addTeam: (team: TeamSummary) => void
  removeTeam: (teamId: string) => void
  removeInvitation: (inviteId: string) => void
  openRemovalModal: (teamId: string) => void
  closeRemovalModal: () => void
  initialize: (payload: { teams: TeamSummary[]; currentTeamId: string | null }) => void
}

function chooseFallbackTeamId(teams: TeamSummary[], requestedTeamId: string | null): string | null {
  if (!requestedTeamId) {
    return teams[0]?.id ?? null
  }

  const stillValid = teams.some((team) => team.id === requestedTeamId)
  return stillValid ? requestedTeamId : teams[0]?.id ?? null
}

export const useTeamStore = create<TeamStoreState>((set) => ({
  currentTeamId: null,
  teams: [],
  invitations: [],
  removedTeamId: null,
  removalModalOpen: false,

  setCurrentTeamId: (teamId) => {
    set((state) => ({
      currentTeamId: chooseFallbackTeamId(state.teams, teamId),
    }))
  },

  setTeams: (teams) => {
    set((state) => {
      const currentTeamId = chooseFallbackTeamId(teams, state.currentTeamId)
      const selectedTeamRemoved = Boolean(state.currentTeamId && !teams.some((team) => team.id === state.currentTeamId))

      return {
        teams,
        currentTeamId,
        removedTeamId: selectedTeamRemoved ? state.currentTeamId : state.removedTeamId,
        removalModalOpen: selectedTeamRemoved || state.removalModalOpen,
      }
    })
  },

  setInvitations: (invitations) => {
    set({ invitations })
  },

  addTeam: (team) => {
    set((state) => {
      const exists = state.teams.some((item) => item.id === team.id)
      if (exists) return state
      return { teams: [...state.teams, team] }
    })
  },

  removeTeam: (teamId) => {
    set((state) => {
      const teams = state.teams.filter((team) => team.id !== teamId)
      const selectedRemoved = state.currentTeamId === teamId
      return {
        teams,
        currentTeamId: selectedRemoved ? chooseFallbackTeamId(teams, null) : chooseFallbackTeamId(teams, state.currentTeamId),
        removedTeamId: selectedRemoved ? teamId : state.removedTeamId,
        removalModalOpen: selectedRemoved || state.removalModalOpen,
      }
    })
  },

  removeInvitation: (inviteId) => {
    set((state) => ({
      invitations: state.invitations.filter((invitation) => invitation.id !== inviteId),
    }))
  },

  openRemovalModal: (teamId) => {
    set({ removedTeamId: teamId, removalModalOpen: true })
  },

  closeRemovalModal: () => {
    set({ removalModalOpen: false, removedTeamId: null })
  },

  initialize: ({ teams, currentTeamId }) => {
    set({
      teams,
      currentTeamId: chooseFallbackTeamId(teams, currentTeamId),
    })
  },
}))
