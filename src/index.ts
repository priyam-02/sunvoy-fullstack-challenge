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
