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