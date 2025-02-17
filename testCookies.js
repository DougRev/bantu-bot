require('dotenv').config();
const fs = require('fs');

if (!process.env.YTDLP_COOKIES_B64) {
  console.error("Error: YTDLP_COOKIES_B64 is not set. Please set it in your .env file or via the command line.");
  process.exit(1);
}

try {
  const cookies = Buffer.from(process.env.YTDLP_COOKIES_B64, 'base64').toString('utf8');
  fs.writeFileSync('temp_cookies.txt', cookies);
  console.log("Cookies saved to temp_cookies.txt. Decoded cookies length:", cookies.length);
} catch (error) {
  console.error("Error decoding YTDLP_COOKIES_B64:", error);
}
