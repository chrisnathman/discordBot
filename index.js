const Discord = require('discord.js')
const ytdl = require('ytdl-core-discord')
const yts = require('yt-search')
const appid = require('appid')
const stringComp = require('string-similarity')
const SteamUser = require('steam-user')

const {
    prefix,
    token,
    maintainer
} = require('./config.json')
const { report } = require('process')

const dClient = new Discord.Client()

const vidQueue = new Map()

var client = new SteamUser()

client.logOn()

client.on('loggedOn', () => {
    console.log('steam login success')
})

client.on('error', err => {
    console.log('steam login failed')
    console.log(err)
})

var prevSearch = null
var iteratedIndex = 0
var vchannel = null

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
    if (!msg.content.startsWith(prefix)) return
    
    const commandStr = msg.content.substring(2).trim()
    const breakIndex = commandStr.indexOf(' ')
    var cmd = commandStr.substring(0, breakIndex)
    var args = commandStr.substring(breakIndex + 1)
    if (breakIndex < 0)
    {
        cmd = args
        args = ''
    }

    switch(cmd) {
        case 'help':
            cmdHelp(args, msg.channel)
            break
        case 'search':
            cmdSearch(args, msg.channel)
            break
        case 'play':
            cmdPlay(args, msg)
            break
        case 'skip':
            cmdSkip(args, msg.channel)
            break
        case 'pause':
            cmdPause(args, msg.channel)
            break
        case 'resume':
            cmdResume(args, msg.channel)
            break
        case 'players':
            cmdPlayers(args, msg.channel)
            break
        default:
            msg.channel.send('unrecognized command')
            msg.channel.send('try >>help')
    }
})

function cmdHelp(args, channel) {
    channel.send('available commands:\n'
               + '**help**   - displays information about the bot commands\n'
               + '**search** - searches youtube with the given arguments\n'
               + '**play**   - plays the video with the given url or the number of a previous search result\n'
               + '**skip**   - skips the video that is currently playing\n'
               + '**pause**  - pauses the video that is currently playing <WIP>\n'
               + '**resume** - continues playing a video that was previously pause <WIP>\n'
               + '**players** - displays the player count for a given steam game <WIP>')
}

async function cmdSearch(args, channel) {
    var printStr = ''
    try {
        const opts = {
            query: args,
            pageStart: 1,
            pageEnd: 1
        }
        yts(opts).then(r => {
            prevSearch = r.videos
            iteratedIndex = 0;

            if (r.videos.length > 0) {
                var i = 0
                for (i = iteratedIndex; i < r.videos.length && i < 5; ++i) {
                    printStr += '**' + i + '**' + ' - ' + r.videos[i].title + '\n'
                    iteratedIndex++
                }
                channel.send(printStr).catch(err => {
                    reportError(channel, '0xAAAA')
                    console.log(err)
                })
            }
            else {
                prevSearch = null
                channel.send('no search results for `' + args + '`').catch(err => {
                    reportError(channel, '0xABCD')
                    console.log(err)
                })
            }
        }).catch(err => {
            reportError(channel, '0xBBBB')
            console.log(err)
        })
        
    }
    catch (err) {
        reportError(channel, '0xCCCC')
        console.log(err)
    }
}

async function cmdPlay(args, msg) {
    vchannel = msg.member.voice.channel
    if (!vchannel) {
        msg.channel.send('you must be in a voice channel to play a video!')
        return
    }

    const permissions = vchannel.permissionsFor(msg.client.user)
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
        msg.channel.send('I do not have sufficient permissions to play videos in this channel')
        return
    }

    if (args === '') {
        msg.channel.send('nothing given to play')
        return
    }

    try {
        if (await ytdl.validateURL(args)) {
            const connection = await vchannel.join()
            connection.play(await ytdl(args), { type: 'opus'})
            .on("finish", () => {
                vchannel.leave()
            })
            .on("error", error => {
                console.error(error)
                msg.channel.send('playback error')
                vchannel.leave()
            })
        }
        else {
            const playIndex = parseInt(args, 10)
            if (isNaN(playIndex) || playIndex < 0) {
                msg.channel.send('invalid input to play, use **>>search** if you want to search for vids')
                return
            }

            if (!prevSearch) {
                msg.channel.send('no previous search to select from, use **>>search** first')
                return
            }

            if (playIndex >= iteratedIndex) {
                msg.channel.send('warning: you have selected a result that is not yet visible')
            }
            const connection = await vchannel.join()
            msg.channel.send('now playing: **' + prevSearch[playIndex].title + '**')
            connection.play(await ytdl(prevSearch[playIndex].videoId), { type: 'opus'})
            .on("finish", () => {
                vchannel.leave()
            })
            .on("error", error => {
                console.error(error)
                msg.channel.send('playback error')
                vchannel.leave()
            })

        }
    }
    catch(err) {
        reportError(channel, '0xDDDD')
        console.log(err)
        vchannel.leave()
    }

}

async function cmdSkip(args, channel) {
    if(vchannel) {
        vchannel.leave()
    }
}

function cmdPause(args, channel) {
    channel.send('pausing of videos happens here (not yet implemented)')
}

function cmdResume(args, channel) {
    channel.send('videos resume here (not yet implemented)')
}

async function cmdPlayers(args, channel) {
    channel.send('Searching Steam...')
    var printStr = ''
    appid(RegExp(args)).then(games => {
        if (games.length > 0) {
            let matchedGames = stringComp.findBestMatch(args, games.map(x => x.name))
            let bestGame = games[matchedGames.bestMatchIndex]
            printStr += 'Game: ' + bestGame.name + '\nID: ' + bestGame.appid + '\n'
            client.getPlayerCount(bestGame.appid, null).then(function(pCount, err) {
                if (err === null) {
                    printStr += 'player count: ' + pCount
                }
                else {
                    printStr += 'error retrieving player count'
                    console.log(err)
                }
                channel.send(printStr).catch(err => {
                    reportError(channel, '0xEEEE')
                    console.log(err)
                })
            }).catch(err => {
                reportError(channel, '0x1234')
                console.log(err)
            })
        }
        else {
            channel.send('no results found, note that this filters out any results that contain differences'
                        +' please ensure that your search matches exactly or bug <@' + maintainer +'> to improve it')
        }
    }).catch(err => {
        reportError(channel, '0xFFFF')
        console.log(err)
    })
}

function reportError(channel, errorID) {
    channel.send('<@' + maintainer + '> an error occurred: ' + errorID)
}