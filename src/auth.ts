//Import required modules
import axios from "axios";
import { CookieJar } from "tough-cookie";
import { wrapper } from "axios-cookiejar-support";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Create a cookie jar to store cookies
const jar = new CookieJar();

// Create an axios instance with cookie support
const client = wrapper(
  axios.create({
    jar,
    withCredentials: true, //ensures cookies are sent with requests
  })
);

/**
 * Logs in to the Sunvoy challenge app using credentials from the environment.
 * Returns an authenticated Axios client with session cookies attached.
 */
export async function login(): Promise<typeof client> {
  await client.post("https://challenge.sunvoy.com/login", {
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
  });
  return client;
}
