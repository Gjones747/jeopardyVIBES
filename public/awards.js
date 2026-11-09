// End-of-night superlatives, built from stats the server already tracks.
// players: [{ name, score, stats: { buzzes, correct, wrong } }]
// wagers:  [{ name, wager, correct }] from Final Jeopardy (optional)
function computeAwards(players, wagers) {
  const out = [];
  const s = p => p.stats || { buzzes: 0, correct: 0, wrong: 0 };
  // Only award a clear winner — a tie for first isn't a superlative.
  const top = (fn) => {
    const sorted = players.slice().sort(fn);
    return sorted[1] && fn(sorted[0], sorted[1]) === 0 ? null : sorted[0];
  };

  const buzzy = top((a, b) => s(b).buzzes - s(a).buzzes);
  if (buzzy && s(buzzy).buzzes) {
    out.push({ t: 'Itchiest trigger finger', w: buzzy.name, d: `${s(buzzy).buzzes} buzz${s(buzzy).buzzes === 1 ? '' : 'es'}` });
  }

  const sharp = top((a, b) => (s(b).correct - s(b).wrong) - (s(a).correct - s(a).wrong));
  if (sharp && s(sharp).correct) {
    out.push({ t: 'Sharpshooter', w: sharp.name, d: `${s(sharp).correct} right, ${s(sharp).wrong} wrong` });
  }

  const bold = (wagers || []).slice().sort((a, b) => b.wager - a.wager)[0];
  if (bold && bold.wager) {
    out.push({ t: 'Boldest final wager', w: bold.name, d: `$${bold.wager.toLocaleString()} and ${bold.correct ? 'nailed it' : 'lost it'}` });
  }

  const brave = top((a, b) => s(b).wrong - s(a).wrong);
  if (out.length < 3 && brave && s(brave).wrong) {
    out.push({ t: 'Fearless guesser', w: brave.name, d: `${s(brave).wrong} confident miss${s(brave).wrong === 1 ? '' : 'es'}` });
  }
  return out.slice(0, 3);
}
