const Discord = require('discord.js')

const {
    prefix,
    token,
} = require('./config.json')

const dClient = new Discord.Client()

const vidQueue = new Map()

dClient.login(token)

dClient.once('ready', () => {
    console.log('bot is ready')
})

dClient.once('reconnecting', () => {
    console.log('bot reconnecting')
})

dClient.once('disconnect', () => {
    console.log('bot disconnected');
})

dClient.on('message', async msg => {
    if (msg.author.bot) return;
    if (!msg.content.startsWith(prefix)) return;

    msg.channel.send('msg received')
    
})