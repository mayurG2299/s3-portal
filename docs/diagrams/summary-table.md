```
📁 /docs/diagrams/
✅ system-architecture.md   — High-level architecture, modules, services, dependencies, background jobs, auth layer
✅ db-schema.md             — 15 tables, 30+ relationships
✅ feature-flow.md          — Secure file upload flow
✅ approval-workflow.md     — 5 states, 8 transitions
✅ api-sequence.md          — Secure file upload API sequence

⚠️  UNCLEAR items found: 
- Some background jobs may be added via scripts/ but only cron-worker and lib/cron.ts are confirmed.
- Some async steps (e.g., multipart completion) may involve additional DB updates and quota checks.
- Additional states may exist for shared links or favorites, but not directly part of file approval.
- Some flows may involve CloudFront for CDN delivery, but only if configured.
```
