# Jeopardy

A self-hosted multiplayer Jeopardy game for local play. One device runs the host panel, one is projected to the TV as the board, and players join from their phones.

## Hosted Version

This game is also publicly accessible at:

https://jeopardy.kaolun.site

## Requirements

- Node.js (v18 or newer)
- npm

## Setup

```bash
npm install
node server.js
```

The server starts on port 2999 by default.

## Playing on a Local Network

All devices must be on the same WiFi network. Find your machine's local IP address:

- Mac: `ipconfig getifaddr en0`
- Linux: `hostname -I`
- Windows: `ipconfig` (look for IPv4 Address)

Then share the URL with everyone: `http://YOUR_IP:3000`

## How It Works

There are four views:

| View | URL | Used by |
|------|-----|---------|
| Join / Home | `/` | Players to join |
| Host Panel | `/host.html` | Game host |
| Board Display | `/board.html` | TV or projector |
| Player View | `/player.html` | Each player's phone |

## Running a Game

1. Open `/host.html` on your device
2. Build a board or load a preset, then click **Create Game**
3. Open `/board.html` on the TV — enter the room code shown in the host panel
4. Players open `/` on their phones and enter their name and the room code
5. Click **Start Game** in the host panel

## Board Builder

- Six categories, five clues each ($200 - $1000)
- Mark any clue as **Daily Double**
- Save and reload boards using local storage
- Four built-in presets: Easy / Family Night, Medium / General, Hard / Expert, College Night

## Daily Double

When a Daily Double clue is selected, the host panel shows a wager form. The host selects which player found it and enters their wager, then clicks **Reveal Clue**. Scoring is based on the wager rather than the face value.

## Final Jeopardy

1. Click **Final Jeopardy** in the host panel sidebar
2. Enter the category, clue, and correct answer
3. Click **Start Final Jeopardy** — players see a wager screen on their phones
4. Once wagers are in, click **Reveal Final Clue**
5. Players see the clue and write their answers
6. The host judges each player correct or wrong using the judging panel
7. Click **End Game** when done

## Scoring

- Correct buzz: +face value (or wager for DD/FJ)
- Wrong answer: -face value, and the next buzzer in line gets to answer
- Scores can be manually adjusted in the host panel

## Resetting

Click **Reset Game** in the host panel to reset all scores and re-open all clues without disconnecting players.
