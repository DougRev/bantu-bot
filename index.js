require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits } = require("discord.js");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const ytSearch = require("yt-search");

// Helper function to check if a string is a valid URL.
function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch (_) {
    return false;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Configure yt-dlp options.
const ytDlpOptions = {
  pythonPath: "python", // Use the "python" command available on Heroku.
  overrideOptions: {
    default_search: "ytsearch"
  }
};

// Set a custom user agent to mimic a common browser.
ytDlpOptions.overrideOptions.user_agent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36";

const tempCookiePath = path.join(__dirname, "temp_cookies.txt");

// Determine and attach cookies if provided.
if (process.env.YTDLP_COOKIES_B64) {
  try {
    const decodedCookies = Buffer.from(process.env.YTDLP_COOKIES_B64, 'base64').toString('utf8');
    console.log("Decoded cookies length:", decodedCookies.length);
    if (decodedCookies.length > 1000) {
      // Write cookies to a temporary file.
      fs.writeFileSync(tempCookiePath, decodedCookies);
      // Pass the file path.
      ytDlpOptions.overrideOptions.cookies = tempCookiePath;
      console.log("Using cookies from file:", tempCookiePath);
    } else {
      console.warn("Decoded cookies appear too short; please check your exported cookies file.");
    }
  } catch (error) {
    console.error("Error decoding YTDLP_COOKIES_B64:", error);
  }
} else if (process.env.YTDLP_COOKIES) {
  if (process.env.YTDLP_COOKIES.length > 1000) {
    fs.writeFileSync(tempCookiePath, process.env.YTDLP_COOKIES);
    ytDlpOptions.overrideOptions.cookies = tempCookiePath;
    console.log("Using plain text cookies from file:", tempCookiePath);
  } else {
    console.warn("YTDLP_COOKIES value appears too short; please check its content.");
  }
} else {
  console.warn("No cookies provided via YTDLP_COOKIES_B64 or YTDLP_COOKIES.");
}

// Initialize DisTube with the YtDlpPlugin using the options.
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  plugins: [new YtDlpPlugin(ytDlpOptions)]
});

const prefix = process.env.PREFIX || "!";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    let query = args.join(" ");
    if (!query) {
      return message.channel.send("Please provide a song name or YouTube URL.");
    }
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.channel.send("You need to be in a voice channel to play music.");
    }
    if (!isValidUrl(query)) {
      try {
        const searchResult = await ytSearch(query);
        if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
          const video = searchResult.videos[0];
          console.log("Found video:", video.title, video.url);
          query = video.url;
        } else {
          return message.channel.send(`No results found for "${query}".`);
        }
      } catch (error) {
        console.error("Error during YouTube search:", error);
        return message.channel.send(`An error occurred during search: ${error.message}`);
      }
    }
    console.log("Final query (URL):", query);
    try {
      await client.distube.play(voiceChannel, query, {
        textChannel: message.channel,
        member: message.member,
        searchSongs: 0
      });
    } catch (error) {
      if (error.errorCode === "NO_RESULT") {
        return message.channel.send(`No results found for "${query}".`);
      }
      console.error("Playback error:", error);
      return message.channel.send(`An error occurred: ${error.message}`);
    }
  } else if (command === "debugsearch") {
    let query = args.join(" ");
    if (!query) {
      return message.channel.send("Please provide a search query.");
    }
    try {
      const results = await ytSearch(query);
      if (results && results.videos && results.videos.length > 0) {
        let response = `Found ${results.videos.length} result(s):\n`;
        results.videos.slice(0, 5).forEach((video, i) => {
          response += `${i + 1}. ${video.title} (${video.url})\n`;
        });
        message.channel.send(response);
      } else {
        message.channel.send(`No results found for "${query}".`);
      }
    } catch (error) {
      console.error("Error during debug search:", error);
      message.channel.send(`An error occurred during search: ${error.message}`);
    }
  } else if (command === "stop") {
    client.distube.stop(message);
  }
});

client.distube
  .on("playSong", (queue, song) => {
    queue.textChannel.send(`🎶 Now playing: **${song.name}**`);
  })
  .on("addSong", (queue, song) => {
    queue.textChannel.send(`✅ Added to queue: **${song.name}**`);
  })
  .on("error", (channel, error) => {
    if (channel) channel.send("An error occurred: " + error);
    else console.error(error);
  })
  .on("empty", channel => {
    channel.send("Voice channel is empty. Leaving the channel.");
  })
  .on("searchNoResult", (message, query) => {
    message.channel.send(`No results found for \`${query}\``);
  });

client.login(process.env.DISCORD_TOKEN);
