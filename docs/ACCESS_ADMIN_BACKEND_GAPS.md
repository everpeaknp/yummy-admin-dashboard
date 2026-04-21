# Access Admin Backend Gaps

Date: 2026-04-21

## Context
The Access & Settings dashboard is wired to existing backend endpoints without any backend changes.
This document lists backend gaps that block a fully platform-scoped admin experience.

## Current Endpoints Used
- GET /users/all
- POST /users
- PATCH /users/{user_id}
- DELETE /users/{user_id}
- POST /users/{user_id}/permissions/
- GET /roles
- GET /roles/permissions
- GET /roles/built-in
- POST /roles
- PUT /roles/{role_id}
- DELETE /roles/{role_id}
- GET /restaurants
- GET /restaurant/{restaurant_id}/admins
- POST /restaurant/{restaurant_id}/admins
- DELETE /restaurant/{restaurant_id}/admins/{user_id}

## Gaps For Platform-Level Admin
1) Global user list
   - /users/all is scoped to the requester's restaurant context.
   - Needed: a platform admin endpoint to list users across all restaurants,
     with optional filters (restaurant_id, role, search).

2) Roles per restaurant
   - /roles is scoped to current_user.restaurant_id.
   - Needed: a platform admin endpoint that accepts restaurant_id as a query param,
     or a superadmin override to select a restaurant context.

3) User permission overrides across restaurants
   - POST /users/{user_id}/permissions/ requires the same restaurant_id as the requester.
   - Needed: a platform admin override to assign permissions for any restaurant user.

4) Restaurant admin transfers
   - Removing owners is blocked. Ownership transfer is not exposed.
   - Needed: a transfer endpoint (restaurant_id, new_owner_id).

5) Global system settings
   - Maintenance mode and trial extension toggles are UI-only.
   - Needed: system settings endpoints for read/update.

6) User email validation
   - /users/all returns UserRead with EmailStr.
   - If any user has a non-email identifier (e.g. "admin"), the response fails with 500.
   - Needed: relax UserRead.email to string or enforce valid emails in the data.

## Notes
- This doc is informational only. No backend changes were made.
