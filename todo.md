# AI Agent - Book Calls & Appointments (Calendly + Gemini)

## Architecture
- **AI Brain**: Google Gemini for natural language conversation
- **Scheduling**: Calendly API (OAuth per user - each CRM user connects their own Calendly)
- **Notifications**: SendGrid email confirmations
- **Storage**: Supabase (appointments, calendly_connections tables)
- **Public**: Chat widget + smart booking form on all subdomains
- **Internal**: Staff can book on behalf of leads in CRM dashboard

## Phases

### Phase 1: Database & Types [ ]
- [ ] Create `calendly_connections` table (per-user OAuth tokens)
- [ ] Create `appointments` table (booked appointments)
- [ ] Create TypeScript types
- [ ] Create Zod validation schemas

### Phase 2: Calendly OAuth Integration [ ]
- [ ] Install `@calendly/api` or use fetch-based Calendly v2 API
- [ ] Create `lib/services/calendly-service.ts` (OAuth flow, event types, availability, booking)
- [ ] `app/api/calendly/connect/route.ts` - Start OAuth flow
- [ ] `app/api/calendly/callback/route.ts` - Handle OAuth callback
- [ ] `app/api/calendly/disconnect/route.ts` - Revoke connection
- [ ] `app/api/calendly/event-types/route.ts` - List user's event types
- [ ] `app/api/calendly/availability/route.ts` - Get available slots
- [ ] `app/api/calendly/book/route.ts` - Create invitee/booking

### Phase 3: AI Agent Core [ ]
- [ ] Install `@google/generative-ai`
- [ ] Create `lib/services/ai-agent-service.ts` (Gemini chat + booking intent detection)
- [ ] Create `lib/services/appointment-service.ts` (CRUD + Calendly sync)
- [ ] Create `lib/actions/appointment.ts` (server actions)
- [ ] `app/api/agent/chat/route.ts` - Streaming AI chat endpoint

### Phase 4: UI Components [ ]
- [ ] `components/agent/chat-widget.tsx` - Floating chat bubble (public-facing)
- [ ] `components/agent/booking-modal.tsx` - Full booking modal with Calendly slots
- [ ] `components/agent/availability-picker.tsx` - Date/time slot picker
- [ ] `components/agent/appointment-card.tsx` - Appointment display card
- [ ] `components/agent/agent-provider.tsx` - Context provider for agent state

### Phase 5: CRM Dashboard [ ]
- [ ] `app/(dashboard)/appointments/page.tsx` - All appointments list
- [ ] `app/(dashboard)/appointments/new/page.tsx` - Manual booking for a lead
- [ ] `app/(dashboard)/appointments/[id]/page.tsx` - Detail + cancel/reschedule
- [ ] Add Calendly connect button to Settings page
- [ ] Add Appointments to dashboard navigation

### Phase 6: Industry Subdomain Integration [ ]
- [ ] Add chat widget + booking to HVAC success page
- [ ] Add chat widget + booking to Plumbing success page
- [ ] Add chat widget + booking to Electrical success page
- [ ] Add chat widget + booking to Smile assessment success page
- [ ] Each subdomain uses the operator's connected Calendly

### Phase 7: Build & Deploy [ ]
- [ ] Verify build passes
- [ ] Commit and push to GitHub
- [ ] Write migration + setup documentation

### Phase 2: Add Chat Widget to Main Landing Pages [x]
- [x] Add ChatWidget component to HVAC landing page (`/hvac`)
- [x] Add ChatWidget component to Plumbing landing page (`/plumbing`)
- [x] Add ChatWidget component to Electrical landing page (`/electrical`)
- [x] Add ChatWidget component to Smile landing page (`/smile`)
- [x] Configure each with industry-specific context
- [x] Test chat functionality on all landing pages
- [x] Verify build passes
- [x] Commit and push changes

### Phase 4: Add agent_conversations Database Migration [ ]
- [x] Create database migration for agent_conversations table
- [x] Create AgentConversationService for managing conversations
- [x] Update chat API route to use conversation service
- [x] Verify build passes
- [ ] Commit and push changes