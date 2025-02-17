require('dotenv').config();
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

// Initialize DisTube.
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  plugins: [new YtDlpPlugin()]
});

const prefix = process.env.PREFIX || "!";

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  // Ignore messages from bots or without the prefix.
  if (message.author.bot || !message.content.startsWith(prefix)) return;
  
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  // --- Play Command ---
  if (command === "play") {
    let query = args.join(" ");
    if (!query) {
      return message.channel.send("Please provide a song name or YouTube URL.");
    }
    
    // Ensure the user is in a voice channel.
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.channel.send("You need to be in a voice channel to play music.");
    }
    
    // If the query is not a valid URL, use yt-search to find the first matching video.
    if (!isValidUrl(query)) {
      try {
        const searchResult = await ytSearch(query);
        if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
          const video = searchResult.videos[0];
          console.log("Found video:", video.title, video.url);
          query = video.url;  // Replace query with the video's URL.
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
        searchSongs: 0 // Automatically select the first result (should be moot now).
      });
    } catch (error) {
      if (error.errorCode === "NO_RESULT") {
        return message.channel.send(`No results found for "${args.join(" ")}".`);
      }
      console.error("Playback error:", error);
      return message.channel.send(`An error occurred: ${error.message}`);
    }
  }
  
  // --- Debug Search Command using yt-search (for debugging only) ---
  else if (command === "debugsearch") {
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
  }
  
  // --- Stop Command ---
  else if (command === "stop") {
    client.distube.stop(message);
  }
});

// DisTube event listeners.
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
