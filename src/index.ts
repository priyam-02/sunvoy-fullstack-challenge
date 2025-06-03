import axios from "axios";
import { CookieJar } from "tough-cookie"; // CookieJar for managing cookies
import { wrapper } from "axios-cookiejar-support"; // Importing axios with cookie support
import * as fs from "fs/promises"; // File system module for reading/writing files
import * as qs from "querystring"; // Query string library for URL encoding
import * as cheerio from "cheerio"; // HTML parsing library
import crypto from "crypto"; // Crypto module for HMAC signing

// Constants for API endpoints and credentials
const BASE_URL = "https://challenge.sunvoy.com";
const BASE_URL2 = "https://api.challenge.sunvoy.com";
const EMAIL = "demo@example.org";
const PASSWORD = "test";
const COOKIE_FILE = "cookiejar.json";

// Setup axios client with cookie support
const jar = new CookieJar();
const client = wrapper(axios.create({ jar, withCredentials: true }));

// Load existing cookies if available
async function loadCookies() {
  try {
    const raw = await fs.readFile(COOKIE_FILE, "utf-8");
    const json = JSON.parse(raw);
    const newJar = CookieJar.deserializeSync(json);
    Object.assign(jar, newJar);
    console.log("Loaded saved session cookies");
  } catch {
    console.log("No previous session found, logging in fresh...");
  }
}

// Save session cookies to file
async function saveCookies() {
  const serialized = await jar.serialize();
  await fs.writeFile(COOKIE_FILE, JSON.stringify(serialized, null, 2));
  console.log("Session cookies saved");
}

// Check if current session is still valid by calling an authenticated endpoint
async function isSessionValid(): Promise<boolean> {
  try {
    const res = await client.post(`${BASE_URL2}/api/settings`);
    return res.status === 200;
  } catch {
    return false;
  }
}

// Perform login by retrieving CSRF nonce and submitting credentials
async function login() {
  try {
    console.log("Fetching login page...");

    // Step 1: Load login page to get nonce
    const loginPage = await client.get(`${BASE_URL}/login`);
    const html = loginPage.data;

    // Step 2: Extract nonce from HTML
    const nonceMatch = html.match(/name="nonce" value="([^"]+)"/);
    if (!nonceMatch) throw new Error("❌ Nonce not found in login page");
    const nonce = nonceMatch[1];

    console.log("Logging in with nonce:", nonce);

    // Step 3: Send login POST with correct field names
    const res = await client.post(
      `${BASE_URL}/login`,
      qs.stringify({
        username: EMAIL, // not "email"
        password: PASSWORD,
        nonce: nonce, // required hidden token
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        maxRedirects: 0,
        validateStatus: (status) => status === 302,
      }
    );

    console.log("✅ Login successful");
  } catch (err: any) {
    if (err.response) {
      console.error("❌ Login failed:", err.response.status);
      console.error("Data:", err.response.data);
    } else {
      console.error("❌ Unexpected error:", err.message);
    }
    throw err;
  }
}

// Fetch all users from the API
async function fetchUsers() {
  try {
    const res = await client.post(`${BASE_URL}/api/users`, {
      headers: { Accept: "application/json" },
    });
    return res.data;
  } catch (error: any) {
    console.error(
      "❌ Failed to fetch users:",
      error.response?.status,
      error.response?.data
    );
    throw error;
  }
}

/**
 * Creates a signed request payload by replicating the logic found in:
 * https://challenge.sunvoy.com/js/settings.fefd531f237bcd266fc9.js
 *
 * How I discovered this:
 * - I opened the browser’s Developer Tools → Network tab while visiting `/settings`.
 * - Observed a POST request to `https://api.challenge.sunvoy.com/api/settings`.
 * - The `Request Payload` was in `application/x-www-form-urlencoded` format and contained:
 *   - Multiple key-value pairs (like `access_token`, `openid`, etc.)
 *   - A `timestamp`
 *   - A `checkcode` (a signature)
 * - I inspected the minified JS file `settings.fefd531f237bcd266fc9.js` from the Network → JS tab.
 * - It imported a `createSignedRequest` function (resolved as HMAC with SHA-1).
 * - The code constructed a string like: `key1=value1&key2=value2...`, sorted alphabetically by key.
 * - It then computed an HMAC-SHA1 signature of that payload using the secret `"mys3cr3t"`.
 * - The signature was uppercased and appended as `checkcode=SIGNATURE`.
 *
 * This function replicates that exact logic.
 */
function createSignedRequest(tokens: Record<string, string>) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const baseParams: Record<string, string> = { ...tokens, timestamp };
  const sortedKeys = Object.keys(baseParams).sort();
  const payload = sortedKeys
    .map((key) => `${key}=${encodeURIComponent(baseParams[key])}`)
    .join("&");

  const hmac = crypto.createHmac("sha1", "mys3cr3t");
  hmac.update(payload);
  const checkcode = hmac.digest("hex").toUpperCase();

  return { fullPayload: `${payload}&checkcode=${checkcode}`, timestamp };
}

// Extract tokens (e.g. access_token, openid, userId) from the hidden input fields
async function extractTokensFromSettings(): Promise<Record<string, string>> {
  const res = await client.get(`${BASE_URL}/settings/tokens`);
  const $ = cheerio.load(res.data);
  const tokens: Record<string, string> = {};
  $("input[type=hidden]").each((_, el) => {
    const id = $(el).attr("id");
    const value = $(el).attr("value");
    if (id && value) tokens[id] = value;
  });
  return tokens;
}

// Fetch authenticated user details (userId, name, email)
export async function fetchMe() {
  const tokens = await extractTokensFromSettings();
  const { fullPayload } = createSignedRequest(tokens);

  const res = await client.post(`${BASE_URL2}/api/settings`, fullPayload, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { id, firstName, lastName, email } = res.data;
  return {
    userId: id,
    firstName,
    lastName,
    email,
  };
}
