require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const search = require('youtube-search');

// YouTube Search Options
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

// When the client is ready, log it.
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Listen for messages.
client.on('messageCreate', async message => {
  // Ignore messages from bots.
  if (message.author.bot) return;
  
  // Use your desired prefix.
  const prefix = process.env.PREFIX || '!';
  if (!message.content.startsWith(prefix)) return;
  
  // Split message content.
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  
  if (command === 'play') {
    const query = args.join(' ');
    if (!query) return message.channel.send('Please provide a search query or YouTube URL.');

    // Check if the query is a valid YouTube URL.
    let videoUrl = '';
    if (ytdl.validateURL(query)) {
      videoUrl = query;
      playVideo(message, videoUrl);
    } else {
      // Use the YouTube Data API via youtube-search package.
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
    // Stop playback and disconnect from voice channel if connected.
    const connection = getVoiceConnection(message.guild.id);
    if (connection) {
      connection.destroy();
      message.channel.send('Playback stopped and disconnected.');
    } else {
      message.channel.send('No active voice connection.');
    }
  }
});

// Function to join voice channel, stream audio, and play video.
async function playVideo(message, videoUrl) {
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.channel.send('You need to be in a voice channel to play music.');

  // Join the voice channel.
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator
  });

  // Stream audio from YouTube.
  const stream = ytdl(videoUrl, { filter: 'audioonly', quality: 'highestaudio' });
  const resource = createAudioResource(stream);
  const player = createAudioPlayer();

  // Subscribe the connection to the audio player.
  connection.subscribe(player);
  player.play(resource);

  // Send a confirmation message once the audio starts playing.
  player.on(AudioPlayerStatus.Playing, () => {
    message.channel.send(`Now playing: ${videoUrl}`);
  });

  player.on('error', error => {
    console.error('Error in audio player:', error);
    message.channel.send('Error playing the video.');
  });
}

client.login(process.env.DISCORD_TOKEN);
