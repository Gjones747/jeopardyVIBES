# Jeopardy! — How to Play with Friends

## Starting the Server

```bash
cd ~/projects/jeopardy
npm start
```

Server runs at `http://localhost:3000`. Keep this terminal open the whole time.

---

## Finding Your Local IP

Run this to get your IP address:

```bash
ipconfig getifaddr en0
```

You'll get something like `10.19.84.234`. Everyone needs to be on the **same WiFi network**.

---

## Setup (Before the Game)

1. **Host** opens `http://10.19.84.234:3000/host.html` on their laptop
2. Build your board — click each cell to enter a clue and answer, OR hit one of the sample board buttons (Easy / Medium / Hard)
3. Click **Create Game & Get Room Code** — you'll get a 4-letter code like `JX7K`
4. Click **Open Board Display** — this opens the TV view in a new tab. Go fullscreen (`Cmd+Shift+F`) and project it to your TV
5. Share the room code with your players

## Players Join

Players open `http://10.19.84.234:3000` on their **phones**, enter their name and the room code, and tap **Join Game**.

Once everyone's in, the host clicks **Start Game**.

---

## Playing

**Picking a question:**
The host clicks a dollar value on their mini-board. The clue appears on the TV.

**Buzzing in:**
All players see a big **BUZZ** button on their phone. First one to tap wins the right to answer.

**Judging the answer:**
- The host sees who buzzed first and hears the answer
- Hit **✓ Correct** — points awarded, question closed
- Hit **✗ Wrong** — points deducted, next person in the buzz queue automatically gets a chance
- **Reveal Answer** shows the answer on the TV board
- **Skip / Close** dismisses the question with no scoring

**Scores** update live on everyone's phone.

---

## Host Controls (During Game)

| Button | What it does |
|---|---|
| ✓ Correct | Awards full dollar value to the first buzzer |
| ✗ Wrong | Deducts full dollar value, passes to next buzzer |
| Reveal Answer | Shows the answer on the TV board |
| Skip / Close | Closes the question, no points |
| Score Adjustment | Manually add or subtract points from any player |
| Reset / New Game | Clears scores and resets the board |

---

## Daily Doubles

Questions marked as Daily Double show a big animated splash on the TV board before revealing the clue. Handle wagering verbally — the host adjusts the score manually using the **Score Adjustment** panel after judging the answer.

---

## Tips

- Put the host laptop in **Do Not Disturb** mode before projecting
- Players should stay on the player page the whole game — if they close it, they can rejoin with the same name and code
- The host mini-board and TV board stay in sync automatically
- If the server restarts mid-game, everyone needs to rejoin

---

## Quick Reference

| Who | URL |
|---|---|
| Host | `http://YOUR_IP:3000/host.html` |
| TV Board | `http://YOUR_IP:3000/board.html` |
| Players | `http://YOUR_IP:3000` |
