type TeamLike = {
  id: string
}

export function resolveActiveTeamId(
  teams: TeamLike[],
  cookieTeamId: string | null | undefined,
  sessionTeamId: string | null | undefined,
) {
  if (cookieTeamId && teams.some((team) => team.id === cookieTeamId)) {
    return cookieTeamId
  }

  if (sessionTeamId && teams.some((team) => team.id === sessionTeamId)) {
    return sessionTeamId
  }

  return teams[0]?.id ?? null
}
