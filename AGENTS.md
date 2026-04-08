# Repository Guidelines

## Project Structure & Module Organization
`app/` contains the Next.js App Router UI, route handlers under `app/api/`, and dashboard pages under `app/dashboard/`. Reusable UI lives in `components/`, shared server and client utilities in `lib/`, custom hooks in `hooks/`, shared types in `types/`, and schema plus seed logic in `prisma/`. Operational scripts live in `scripts/`, request-wide access control is enforced in `middleware.ts`, static assets and hosted docs live in `public/`, and longer-form documentation belongs in `docs/`. Tests are organized under `__tests__/` by domain, for example `__tests__/rbac/` and `__tests__/lib/`.

## Build, Test, and Development Commands
Use `npm run dev` to start local development. Use `npm run build` to verify the production bundle, and `npm run start` to run that build locally. Use `npm run lint` for ESLint, `npm test` for the Jest suite, and `npm run test:coverage` when changing RBAC, auth, or API behavior. Database workflows use Prisma: `npm run db:generate`, `npm run db:push`, `npm run db:migrate`, `npm run db:seed`, and `npm run db:studio`.

## Coding Style & Naming Conventions
This repository is TypeScript-first with Next.js and Tailwind CSS. Follow the existing style: 2-space indentation, semicolons, single quotes, and path aliases via `@/`. Use `PascalCase` for React components, `camelCase` for functions and variables, and kebab-case only where framework conventions require it. Keep route-specific logic near the route, and move shared authorization, crypto, or AWS helpers into `lib/`.

## Testing Guidelines
Jest runs in `jsdom` with `jest.setup.js`. Add tests in `__tests__/` using `*.test.ts` or `*.test.tsx`, mirroring the feature area you changed. Prefer focused unit and integration coverage for `lib/` and `app/api/`; these paths are included in coverage collection. Run `npm test` before opening a PR, and run `npm run test:coverage` for permission, team, or sharing changes.

## Commit & Pull Request Guidelines
Recent history follows short Conventional Commit prefixes such as `fix:`, `feat:`, and `docs:`. Keep commits scoped and descriptive, for example `fix: harden preview URL authorization`. PRs should explain user-facing impact, note any schema or env changes, link the relevant issue, and include screenshots for dashboard or onboarding UI changes.

## Security & Configuration Tips
Do not commit real secrets in `.env`. Start from `.env.example`, keep `NEXTAUTH_SECRET` and `ENCRYPTION_KEY` set locally, and document any new required variables. Changes touching S3 access, credential encryption, sharing links, or audit logging should include tests and a brief security note in the PR.
