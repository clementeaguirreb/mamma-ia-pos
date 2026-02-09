# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mamma Ia POS is a Point of Sale system for a pasta restaurant. It's a single-page application built with vanilla JavaScript, Alpine.js for reactivity, Tailwind CSS for styling, and Firebase Realtime Database for backend persistence.

## Development

This is a static web application with no build process. To run locally:
- Serve the files with any static file server (e.g., `npx serve`, VS Code Live Server, Python's `http.server`)
- Open `index.html` in a browser
- Requires `firebase-config.js` with valid Firebase credentials (not tracked in git)

## Architecture

### Module System (`js/namespace.js`)
The app uses a custom namespace pattern via `window.MammaIA`:
- Each module is an IIFE that calls `MammaIA.register(state, methods)`
- State objects and method descriptors accumulate globally
- `MammaIA.createApp()` returns the final object for Alpine.js
- Uses `Object.defineProperties` to preserve getters (computed properties)

### Module Load Order (critical)
Scripts must load in this exact order in `index.html`:
1. `namespace.js` - Creates MammaIA global
2. `config.js` - Default menu configuration
3. `utils.js` - Formatting, dates, notifications, APP_CONSTANTS
4. `auth.js` - PIN-based login, session management
5. `stock.js` - Inventory management
6. `cart.js` - Shopping cart, item selection
7. `orders.js` - Order CRUD, Firebase listeners
8. `kitchen.js` - Kitchen display, order status
9. `stats.js` - Analytics, charts
10. `admin.js` - Menu configuration
11. `app.js` - Main initialization, must load last

### Key Data Structures

**Stock keys**: `{pastaName}_{masaName}` for dishes (e.g., `Spaguetti_Huevo`), `extra_{extraName}` or `extra_{extraName}_{variantName}` for tracked extras.

**Order object**:
```javascript
{
  id: string,           // Firebase push key
  number: number,       // Daily sequential number
  date: 'YYYY-MM-DD',
  timestamp: number,    // Firebase ServerValue.TIMESTAMP
  customer: string,
  scheduledTime: string|null,  // 'HH:MM' for scheduled orders
  items: Array<{type: 'dish'|'extra', title, price, pasta?, masa?, salsa?, extraName?, variantName?}>,
  total: number,
  status: 'Pendiente'|'Listo',
  paymentMethod: string|null,
  readyTimestamp?: number
}
```

### Firebase Structure
- `/config` - Menu items (pastas, masas, salsas, extras)
- `/orders` - All orders
- `/stock` - Current inventory counts
- `/pins` - Admin/guest PIN codes

### Views
- `pos` - Cash register (accessible by all roles)
- `kitchen` - Order queue with status management (admin only)
- `stock` - Inventory management (admin only)
- `stats` - Sales analytics with Chart.js (admin only)
- `admin` - Menu configuration (admin only)

### Authentication
Simple PIN-based auth stored in localStorage with 24-hour expiration. Two roles: `admin` (full access) and `guest` (POS only).

## Code Conventions

- ES5 syntax throughout (no arrow functions, template literals, or let/const)
- All functions use explicit `var self = this` for context preservation in callbacks
- Prices stored in CLP (Chilean Pesos) as integers
- Dates formatted as 'YYYY-MM-DD' strings for Firebase queries
- Use `firebase.database.ServerValue.TIMESTAMP` for server-side timestamps
- Use `APP_CONSTANTS` from `utils.js` for magic numbers (session duration, toast duration, etc.)

## File Structure

```
/
├── index.html
├── css/styles.css
├── js/
│   ├── namespace.js → config.js → utils.js → auth.js → stock.js
│   ├── cart.js → orders.js → kitchen.js → stats.js → admin.js → app.js
├── firebase-config.js (gitignored)
├── firebase-config.example.js
└── firebase.rules.json
```
