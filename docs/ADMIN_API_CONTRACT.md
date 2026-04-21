# Yummy Admin Dashboard API Contract

Date: 2026-04-20

## Purpose

This document defines how the `yummy-admin-dashboard` Next.js app should stop using static mock data and start consuming the real Yummy backend APIs.

The backend already has a few useful dashboard and admin endpoints. The frontend should use them in layers:
- overview and live metrics,
- restaurant management,
- roles and access control,
- then billing / plans / subscriptions / payments.

## Primary Backend Sources

By default, the Next dashboard should call the same Azure backend used by the desktop app:
- `https://yummy-container-app.ambitiouspebble-f5ba67fe.southeastasia.azurecontainerapps.io`

Keep `NEXT_PUBLIC_BACKEND_URL` only as an override for special environments.

### Platform dashboard
- `GET /admin/platform/dashboard`

### Dashboard
- `GET /admin/dashboard/v2`
- `GET /admin/dashboard/v2/delta`
- `GET /admin/dashboard/lite`
- `GET /admin/dashboard`

### Auth
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Restaurants and admins
- `GET /restaurants`
- `GET /restaurants/{restaurant_id}`
- `GET /restaurants/by-user`
- `PUT /restaurants/{restaurant_id}`
- `GET /restaurant/{restaurant_id}/admins`
- `POST /restaurant/{restaurant_id}/admins`
- `DELETE /restaurant/{restaurant_id}/admins/{user_id}`
- `GET /users/me/restaurants`

### Roles and permissions
- `GET /roles`
- `GET /roles/permissions`
- `GET /roles/built-in`

## Current UI Pages And Their Intended Data Sources

### Overview
Use `/admin/platform/dashboard` as the main source for the superadmin console.

Keep `/admin/dashboard/v2` and `/admin/dashboard/lite` for restaurant-scoped operations only.

### Restaurants
Replace static data in the restaurant pages with `/restaurants` and `/restaurants/{id}`.

The admin association modal or section should use:
- `/restaurant/{restaurant_id}/admins`
- `/users/me/restaurants`

### Settings
Use the auth and roles endpoints for user-level and permission-level controls.

### Plans / Subscriptions / Payments
These pages are not fully covered by the current backend in a clean list-friendly way.

They will likely need one or more of these:
- a platform admin API for subscriptions,
- a platform admin API for payments,
- a platform admin API for plan definitions,
- a clean platform summary endpoint for superadmin KPIs.

## Frontend Architecture Rules

1. Do not read `lib/data.ts` or `lib/restaurantData.ts` directly in live pages after wiring the API.
2. Add one typed API client module for all backend calls.
3. Normalize backend payloads into frontend view models.
4. Keep auth state in one place.
5. Handle loading, error, empty, and unauthorized states on every page.
6. Keep `/sysadmin` separate from the Next app. Do not try to copy SQLAdmin behavior into React.

## Suggested Implementation Order

### Phase 1
- Auth flow,
- overview dashboard,
- restaurant list,
- restaurant detail pages.

### Phase 2
- admins / role management,
- settings,
- route protection and permissions.

### Phase 3
- payments,
- subscriptions,
- plans.

### Phase 4
- live polling / delta updates,
- analytics drilldowns,
- performance and UX polish.

## Missing Backend Work That Should Be Planned

The frontend will still need better backend support for:
- paginated global restaurant search,
- platform-level subscriptions and payments lists,
- superadmin metrics for the whole platform,
- secure browser auth strategy,
- audit logging for admin actions.

## Notes

The current backend already has a stronger dashboard shape in `/admin/dashboard/v2` than in the legacy dashboard. That should be the default overview source for the new frontend.
