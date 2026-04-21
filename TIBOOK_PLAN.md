# TiBook — Direct Booking Tool Plan

## Context
TiBook is a guest-facing direct booking app, separate from TiMag (the host management tool, `3rd-air-champion-frontend`).
The goal is to let returning AirBnB guests book directly, bypassing AirBnB fees, while keeping the trusted guest relationship.

## Why a Separate App
- TiMag is for the host — complex, data-dense, private
- TiBook is for guests — simple, trust-building, mobile-first, public
- Different deployment, different audience, different UX

## Current State
- TiBook skeleton already exists at `/ti-book` (Next.js app)
- Has a basic calendar and sidebar scaffold
- Shares the same backend as TiMag (GraphQL + REST API)
- Backend already has: `bookDays` mutation, Guest model, Room model, Day schema

## Booking Flow (Guest Journey)
1. Browse availability — public calendar showing open dates per room
2. Select dates + room — pricing shown upfront
3. Enter details — name, email, number of guests
4. Confirm booking — email confirmation sent to guest and host
5. Payment — Stripe (later phase; manual payment acceptable initially)

## Build Priority

| Priority | Task | Notes |
|----------|------|-------|
| 1 | Public availability calendar | Read-only, no auth required |
| 2 | Date selection + booking request form | Guest fills in details |
| 3 | Email confirmation (backend) | Notify both guest and host |
| 4 | Stripe payment integration | Later phase |

## Broader Strategic Direction
- **Do not expand to Booking.com** — guest vetting is weaker, safety concern raised
- **AirBnB partnership** is the long-term goal (apply as a software/connectivity partner)
- **Booking.com Connectivity Partner** is a faster approval path and can serve as proof of concept for AirBnB application
- TiBook + TiMag together = a channel manager / PMS product, which is exactly what AirBnB and Booking.com connectivity partners build

## Backend Changes Needed (when building)
- Add a public (unauthenticated) availability query endpoint
- Add email notification on booking confirmation
- No schema changes needed for Phase 1

## Files of Interest
- TiBook frontend: `/ti-book/`
- Shared backend: `/3rd-air-champion-backend/`
- Host tool (TiMag): `/3rd-air-champion-frontend/`
- Returning guest flag already in Guest model: `returning: boolean`