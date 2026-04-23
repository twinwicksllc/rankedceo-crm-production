# RankedCEO Next Product Sprint Roadmap

## Sprint 1: AI Variant Direction (Completed)
Goal: move from manual theme toggles to AI-guided variant recommendations using onboarding data.

Deliverables:
- Add AI recommendation engine for the 3 current templates (modern, bold, trust-first).
- Surface ranked recommendations with rationale in Admin Preview.
- Enable one-click apply from recommendation card.

Acceptance criteria:
- Admin can click "Generate Recommendations" and see 3 ranked options.
- Each recommendation includes: template slug, short label, rationale, confidence, and section highlights.
- Recommending works with and without GEMINI_API_KEY (fallback logic).

## Sprint 2: Client Comparison Experience (In Progress)
Goal: provide a client-facing A/B/C selection experience (not admin-only).

Deliverables:
- Build a client review page with three options side-by-side.
- Add desktop/tablet/mobile viewport toggles.
- Add selection workflow: approve one variant and mark status for deployment queue.

Acceptance criteria:
- Client can open a review URL and compare all three options.
- Client can choose one and trigger a persisted "selected" state.

## Sprint 3: Iteration and Remix Loop
Goal: support structured feedback and iterative regeneration.

Deliverables:
- Add feedback inputs (tone, CTA intensity, layout preference, notes).
- Add "regenerate selected variant" and "mix from A/B/C" actions.
- Keep version history for each iteration.

Acceptance criteria:
- User can submit feedback and receive a regenerated variant.
- Prior version remains accessible for rollback.

## Sprint 4: Deployment + QA Automation
Goal: make handoff/deploy repeatable and production-safe.

Deliverables:
- Add pre-deploy checks (SEO metadata, core section presence, performance guards).
- Add deployment package summary (selected template, sections, metadata, contact hooks).
- Add deploy audit trail (who deployed, when, what version).

Acceptance criteria:
- Deploy flow blocks on failed validation.
- Deployed version includes immutable config snapshot.
