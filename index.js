require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const search = require('youtube-search');

// YouTube Search Options (using the YouTube Data API)
const searchOpts = {
  maxResults: 1,
  key: process.env.YOUTUBE_API,  // Your YouTube API key
  type: 'video'
};

// Create a new Discord client with necessary intents.
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Log when the client is ready.
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Listen for messages.
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;
  
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) return message.channel.send('Please provide a search query or YouTube URL.');

    let videoUrl = '';

    // Check if the query is a valid YouTube URL.
    if (ytdl.validateURL(query)) {
      videoUrl = query;
      playVideo(message, videoUrl);
    } else {
      // Use the YouTube Data API via the youtube-search package.
      search(query, searchOpts, (err, results) => {
        if (err) {
          console.error(err);
          return message.channel.send('Error searching YouTube: ' + err.message);
        }
        if (!results || results.length < 1) {
          return message.channel.send('No results found for your query.');
        }
        videoUrl = results[0].link;
        console.log('Found video:', results[0].title, videoUrl);
        playVideo(message, videoUrl);
      });
    }
  } else if (command === 'stop') {
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      message.channel.send('Playback stopped and disconnected.');
    } else {
      message.channel.send('No active voice connection.');
    }
  }
});

// Function to join voice channel, stream audio, and play the video.
async function playVideo(message, videoUrl) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music.');

  // Join the voice channel.
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator
  });

  // Use ytdl-core to stream audio with an increased buffer (highWaterMark).
  const stream = ytdl(videoUrl, { 
    filter: 'audioonly', 
    quality: 'highestaudio',
    highWaterMark: 1 << 25  // 32 MB buffer; adjust if needed
  });

  const resource = createAudioResource(stream);
  const player = createAudioPlayer();

  // Subscribe the connection to the audio player.
  connection.subscribe(player);
  player.play(resource);

  player.on(AudioPlayerStatus.Playing, () => {
    message.channel.send(`Now playing: ${videoUrl}`);
  });

  player.on('error', error => {
    console.error('Error in audio player:', error);
    message.channel.send('Error playing the video.');
  });
}

client.login(process.env.DISCORD_TOKEN);
