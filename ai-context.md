# AI Context Blueprint: World Cup Friends Betting Application

Use this file to fully reconstruct, migrate, or upscale this application into any other technology stack (e.g., React, Flutter, OutSystems, Next.js).

## 1. System Architecture
- **Type:** Lightweight Full-Stack Web Application.
- **State Management:** Client-side sessions are tracked via `localStorage` storing a dictionary of `{ groupId: { userId, userName } }`.
- **Database:** Single JSON file (`database.json`) acting as a relational document store.

## 2. Database Schema (`database.json`)
```json
{
  "groups": {
    "GROUP_ID": {
      "group_name": "String",
      "admin_id": "String (matches a userId)",
      "adminName": "String",
      "entry_fee": "Number",
      "paybox_link": "String",
      "betsLocked": "Boolean",
      "unpaidLockMode": "String ('spectator' | 'remove')",
      "members": {
        "USER_ID": {
          "userName": "String",
          "has_paid": "Boolean"
        }
      }
    }
  },
  "predictions": {
    "USER_ID": {
      "teams": {
        "first": "String (Country Name)",
        "second": "String (Country Name)"
      },
      "scorers": {
        "first": "String (Player Name)"
      }
    }
  }
}
```

## 3. Core Business Logic & Constraints
Authentication: No passwords. User authenticates by visiting a group link (bet.html?groupId=XYZ). If no session exists in localStorage for that groupId, they register a userName, generating a unique userId saved locally and added to the group's members object in the DB.

Admin Rights: If group.admin_id === currentUserId, the user gains access to admin.html to toggle payment statuses (has_paid), modify metadata, and lock bets.

The Lock Mechanism (Crucial):

When betsLocked is true, bet.html inputs and save buttons must be disabled.

If unpaidLockMode is 'remove', users with has_paid: false are entirely excluded from the leaderboard array loop.

If unpaidLockMode is 'spectator', unpaid users remain visible but their score is hardcoded to 0 and a spectator badge/icon is rendered next to their name.

## 4. API Endpoints Blueprint
GET /api/groups/:id - Returns group metadata, member rosters, and all group-related predictions.

POST /api/groups - Creates a new group, establishes the creator as admin_id.

POST /api/groups/:id/bet - Saves or updates a user's predictions.

POST /api/groups/:id/toggle-payment - Admin-only endpoint to toggle has_paid status.

POST /api/groups/:id/lock - Admin-only endpoint to set betsLocked: true and define unpaidLockMode.

## 5. Upgrade Roadmap Tracker

### Stage 0: Security & Secret Hygiene
Status: In progress

Goals:
- Remove exposed secrets from docs and code.
- Move all credentials to environment variables.
- Rotate leaked credentials.

Definition of Done:
- No secrets remain in repository files.
- App boots using environment variables only.
- `.env.example` exists and is complete.

Checklist:
- [x] Remove credentials from README and tracked files.
- [x] Add env-based config loading.
- [ ] Rotate Football API token and MongoDB credentials.
- [x] Add `.env.example` with placeholders.

Notes:
- Remaining manual step: rotate previously exposed credentials in external services and update deployment secrets.

### Stage 1: Current-State Audit
Status: Complete

Goals:
- Map server routes and data flow.
- Map frontend screens and user journeys.
- Validate actual database shape against intended schema.

Definition of Done:
- Gap list approved.
- Technical roadmap refined by module.

Checklist:
- [x] Review `server.js` endpoints and middleware.
- [x] Review public pages and navigation flow.
- [x] Review `database.json` structures and edge cases.

### Stage 2: Design System + English Localization
Status: Complete

Goals:
- Establish premium dark sports visual language.
- Convert UI text to English.
- Keep user and group names free-form (Hebrew/custom allowed).

Definition of Done:
- All navigation, buttons, and messages are in English.
- Shared design tokens are used across pages.
- Responsive behavior is verified on mobile and desktop.

Checklist:
- [x] Define color, spacing, typography, and motion tokens.
- [x] Replace Hebrew UI labels with English copy.
- [x] Unify button, card, input styles, and transitions.

### Stage 3: Google OAuth + Sessions
Status: Not started

Goals:
- Implement real authentication with Google.
- Replace temporary local identity with session-based identity.
- Introduce role-aware route protection.

Definition of Done:
- Login and logout work reliably.
- Profile includes avatar, email, and display name.
- Protected routes reject unauthorized access.

Checklist:
- [ ] Add OAuth strategy and callback routes.
- [ ] Add secure session and cookie configuration.
- [ ] Map users to internal roles (user/admin).
- [ ] Add migration strategy from localStorage users to OAuth users.

### Stage 4: Entrance Experience
Status: Not started

Goals:
- Add branded splash overlay on app entry and major section switches.
- Create smooth reveal transitions into content.

Definition of Done:
- Overlay appears reliably and fades out smoothly.
- No visual jank during transitions.

Checklist:
- [ ] Add overlay component and animation states.
- [ ] Trigger on initial load and section navigation.
- [ ] Tune durations and easing for consistent feel.

### Stage 5: My Groups Directory
Status: Not started

Goals:
- Build scannable group cards with key metrics.

Definition of Done:
- Each card shows total pot size.
- Each card shows current leader.
- Each card shows current user rank in that group.

Checklist:
- [ ] Add group summary API shape if missing.
- [ ] Render metric-first card layout.
- [ ] Add empty, loading, and error states.

### Stage 6: Group Dashboard Upgrade
Status: Not started

Goals:
- Expose match-by-match betting status.
- Show active vs locked games clearly.
- Show point distribution analytics.

Definition of Done:
- Lock state is obvious and enforced.
- Users can understand scoring breakdown at a glance.

Checklist:
- [ ] Add match list with status badges.
- [ ] Show betting status per user and match.
- [ ] Add analytics widgets for points and trends.

### Stage 7: Leaderboard 3-2-1 Reveal
Status: Not started

Goals:
- Show "Last Checked" timestamp.
- Run 3-2-1 countdown reveal.
- Animate ranking changes smoothly.

Definition of Done:
- Countdown and reveal flow works consistently.
- Rank up/down transitions animate without data glitches.

Checklist:
- [ ] Persist and display last-checked time.
- [ ] Build countdown overlay sequence.
- [ ] Animate row reordering based on new standings.

### Stage 8: Admin Panel + DB Health Dashboard
Status: Not started

Goals:
- Enable secure admin operations.
- Provide operational visibility.

Definition of Done:
- Admin can update match results and manage users.
- Admin sees platform stats and DB health indicators.

Checklist:
- [ ] Add admin-only guard middleware.
- [ ] Build match result management UI and endpoints.
- [ ] Add user and profile management tools.
- [ ] Add DB health and aggregate stats view.

### Stage 9: Betting & Standings Analytics Engine
Status: Not started

Goals:
- Implement scoring engine for exact score vs outcome trends.
- Aggregate standings by categories and overall.

Definition of Done:
- Scoring rules are deterministic and documented.
- Standings update correctly from source results.

Checklist:
- [ ] Define scoring constants and rule matrix.
- [ ] Compute per-match and aggregate points.
- [ ] Add tests for edge cases and ties.

### Stage 10: QA, Hardening, Deployment
Status: Not started

Goals:
- Reduce regressions before release.
- Ensure stable production rollout.

Definition of Done:
- Core flows pass test and smoke checks.
- Deployment checklist is completed.

Checklist:
- [ ] Add unit and integration tests for core backend logic.
- [ ] Run smoke tests for auth, bet, leaderboard, and admin.
- [ ] Perform performance and basic security review.
- [ ] Complete release and rollback checklist.

## 6. Progress Board
- [ ] Stage 0 complete
- [x] Stage 1 complete
- [x] Stage 2 complete
- [ ] Stage 3 complete
- [ ] Stage 4 complete
- [ ] Stage 5 complete
- [ ] Stage 6 complete
- [ ] Stage 7 complete
- [ ] Stage 8 complete
- [ ] Stage 9 complete
- [ ] Stage 10 complete