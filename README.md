# Loom Video Link

- [`Video Link`](https://www.loom.com/share/8308302dcb3548829d888cd357b1980d?sid=29d99cc4-be7a-45ef-9474-8066aeedddfa)

# Sunvoy Full-Stack Challenge

This project reverse-engineers a legacy web application (`https://challenge.sunvoy.com`) to programmatically extract the list of users and the currently authenticated user, despite no public API being available.

## Assignment Goals

- Extract the list of users from the internal API.
- Retrieve the currently logged-in user’s information.
- Store both in a pretty-formatted `users.json` file.
- Reuse authentication credentials for subsequent runs.
- Keep dependencies to a minimum.

## Features

- Logs in using a known email and password
- Loads and saves session cookies for reuse
- Extracts hidden input tokens from `/settings/tokens`
- Reconstructs the `checkcode` signature using HMAC-SHA1 based on reverse-engineered JavaScript
- Fetches authenticated user info via `POST /api/settings`
- Fetches all users from `POST /api/users`
- Saves the result to `users.json`

## Technologies Used

- `axios` – HTTP client with cookie support
- `tough-cookie` + `axios-cookiejar-support` – persistent cookie jar handling
- `cheerio` – server-side HTML parsing to extract tokens
- `crypto` – Node’s built-in module to compute HMAC signature
- `fs/promises` – asynchronous file operations

## How the Signature is Generated (Reverse Engineering)

While inspecting the `/settings` page on the frontend, a POST request was observed to `https://api.challenge.sunvoy.com/api/settings`. This request included:

- User-specific tokens like `access_token`, `apiuser`, `openid`
- A `timestamp` (UNIX epoch time)
- A `checkcode` used for verification

To replicate this behavior:

1. We reviewed the JavaScript file:  
   [`/js/settings.fefd531f237bcd266fc9.js`](https://challenge.sunvoy.com/js/settings.fefd531f237bcd266fc9.js)
2. This file imports a `createSignedRequest` function that:
   - Appends a `timestamp` to the token set
   - Sorts keys alphabetically
   - Builds a URL-encoded payload string
   - Creates a HMAC-SHA1 hash using secret key `"mys3cr3t"`
   - Converts the hash to uppercase and adds it as `checkcode`

Our script reimplements this logic in TypeScript using the native `crypto` module.

## Installation

```bash
git clone https://github.com/yourusername/sunvoy-fullstack-challenge.git
cd sunvoy-fullstack-challenge
npm install
```

## Run the script

```bash
npm run start
```
