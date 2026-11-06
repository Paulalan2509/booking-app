# Bluebird Barbers — booking and enquiry app (concept)

A front-end booking app for a **fictional** neighbourhood barbershop. Visitors choose a service, pick a date and a genuinely free time, enter their details and receive a confirmation code. They can review and cancel bookings, and send an enquiry.

**Concept project, no backend.** Bookings and enquiries are saved only in the visitor's browser (`localStorage`). Nothing is sent anywhere, no payment is taken, and the shop, prices and "already taken" slots are sample data.

## Features
- 4-step booking flow with progress, back navigation and a final review
- Availability rules: open Mon–Sat 10:00–19:00, closed Sundays, 14 bookable days, no slots within the next hour
- Service length matters: a 60-minute service needs two free half-hours
- Some slots are always "taken" (a fixed pattern per date) so availability feels real
- Double-booking protection, including a final re-check when you confirm
- Friendly validation: errors in plain words, focus moves to the first problem, Indian mobile format check
- Confirmation code (BB-XXXXX, no look-alike characters), My bookings list, cancel with confirmation
- Enquiry form with honeypot field and validation (saved locally in this demo)
- Works without a mouse: arrow keys move inside the date and time groups, focus moves to each step heading, a polite live region announces changes
- Responsive from 360px; reduced-motion respected; no external requests (fonts are self-hosted, SIL OFL)

## Files
`index.html` · `css/style.css` · `js/app.js` · `assets/` (fonts, og-image) · `docs/` (screenshots)

## Run it
No build step. Open `index.html`, or run `python3 -m http.server` in this folder.

## Make it real (next steps)
Replace the `localStorage` calls in `js/app.js` (`store.get` / `store.set`) with calls to a small API or a hosted form service, and keep the availability check on the server so two people can never take the same slot.

## Publish on GitHub Pages
Repo named `booking-app`, upload everything, Settings → Pages → `main` / root. Expected URL: `https://paulalan2509.github.io/booking-app/`.

Author: Paul Alain Nyoum
