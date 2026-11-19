# Findly — Community Lost & Found Platform

Findly is a fast, responsive, cloud-first lost-and-found web application built with Node.js, Express, Tailwind CSS, and Google Cloud Firestore.

## Features

- **Pure Cloud-First Architecture**: 100% of data is stored directly in Google Cloud Firestore. Zero local database and zero browser `localStorage`.
- **Direct Offline Handover**:
  - Found and lost listings require contact phone numbers.
  - Direct clickable phone calls (`tel:...`) for offline proof verification and in-person handover.
  - One-click status toggle between `open` and `closed`.
- **Privacy & Visibility Filtering**:
  - Current user's own items are strictly excluded from **Home** and **Browse All**.
  - Current user's items are accessible and managed exclusively in **My Items**.
- **Proactive Match Detection**:
  - Real-time check when posting lost items against existing open found items using keyword analysis.
  - Glowing visual alert and one-click redirect to matching found listings.
- **Admin Dashboard**:
  - Live inventory tracking across 6 distinct metrics: Lost & Not Found, Found & Not Collected, Lost & Collected, Found & Collected, Total Resolved, and Total Items.
  - Full status modification control across all community listings.
- **Dark Mode**: Default dark mode with instant theme switcher.

## Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Firebase**:
   Place your `serviceAccountKey.json` in the root folder or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env`.

3. **Start the Application**:
   ```bash
   node server.js
   ```
   Open `http://localhost:3000` in your browser.

4. **Run Test Suite**:
   ```bash
   node test-findly.js
   ```

## Contribute
* This project is open to contributions 
* Fork and send a PR 
* Happy Coding