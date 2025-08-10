# ProofSkill Frontend (SvelteKit)

Production-grade SaaS UI for the ProofSkill AI recruitment platform.

## Stack
- SvelteKit
- TailwindCSS + design tokens (shadcn-inspired)
- TypeScript strict
- Zod for schema validation
- Chunked audio recording with silence detection

## Scripts
- dev: start development server
- build: production build
- preview: preview production build
- check: type + svelte check

## Environment
Create `.env` with:
```
PROOFSKILL_API_URL=http://localhost:4000
```

## Audio Recording
`ChunkedRecorder` provides chunk callbacks and full blob assembly on stop.

## Rubric Visualization
`RubricVisualizer` expects concepts with weights and match booleans; computes weighted percentage.

## Next Steps
- Implement auth pages (login/register)
- Add CV upload flow
- Integrate interview SSE evaluation stream
- Build recruiter dashboards
- Harden security (CSRF not needed for pure API JWT; enforce file size limits client-side)

---
Production focused: no hardcoded secrets; use environment variables + server-only `+page.server.ts` where needed.
