// Plays a clue's sound clip (from a start time to an optional stop time) from
// either a direct audio link (.mp3, .wav, …) or a YouTube link. Used by the
// host's clue editor preview and by the TV.
//
// YouTube doesn't allow hiding its player while it plays, so a YouTube clip
// shows the video in `ytBox`. Pages style `ytBox` themselves.

const Media = (() => {
  // The 11-character video id from any common YouTube link, or null.
  function youtubeId(url) {
    let u;
    try { u = new URL(String(url).trim()); } catch (e) { return null; }
    const host = u.hostname.toLowerCase().replace(/^(www\.|m\.|music\.)/, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else id = (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/) || [])[1];
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  // The start time in a YouTube link (?t=90, ?t=1m30s, ?start=90), in seconds, or null.
  function youtubeTime(url) {
    let u;
    try { u = new URL(String(url).trim()); } catch (e) { return null; }
    const t = (u.searchParams.get('t') || u.searchParams.get('start') || '').trim();
    if (/^\d+(\.\d+)?s?$/.test(t)) return parseFloat(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!t || !m) return null;
    return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  }

  let apiPromise = null;
  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve();
    if (!apiPromise) apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.onerror = () => { apiPromise = null; reject(new Error('YouTube could not load')); };
      document.head.appendChild(s);
    });
    return apiPromise;
  }

  // onChange(state, detail) gets: 'playing', 'paused', 'loaded', 'blocked'
  // (the browser wants a click before it plays sound), or 'error'.
  function ClipPlayer({ audio, ytBox, onChange = () => {} }) {
    let url = '', ytId = null, yt = null, ytReady = null, cuedId = null;
    let start = 0, end = null;
    let pending = false;  // play() was called; the stop time applies once it starts
    let armed = false;    // playing a clip that should stop at `end`
    let timer = null, blockTimer = null;

    const now = () => ytId ? (yt && yt.getCurrentTime ? yt.getCurrentTime() || 0 : 0) : audio.currentTime;
    const isPlaying = () => ytId ? !!(yt && yt.getPlayerState && yt.getPlayerState() === 1) : !audio.paused;

    // Pause at the stop time: a timer aimed at it, re-checked on each update.
    function check() {
      clearTimeout(timer);
      if (!armed || end == null || !isPlaying()) return;
      const left = end - now();
      if (left <= 0.02) { pause(); return; }
      timer = setTimeout(check, Math.max(10, Math.min(250, left * 1000 - 15)));
    }
    function started() {
      if (pending) { pending = false; armed = true; }
      clearTimeout(blockTimer);
      check();
      onChange('playing');
    }
    function stopped() { armed = false; clearTimeout(timer); onChange('paused'); }

    audio.addEventListener('timeupdate', check);
    audio.addEventListener('playing', started);
    audio.addEventListener('pause', stopped);
    audio.addEventListener('loadedmetadata', () => onChange('loaded'));
    audio.addEventListener('error', () => { if (!ytId && url) onChange('error', 'audio'); });

    function ensureYT() {
      if (!ytReady) ytReady = loadYouTubeAPI().then(() => new Promise(resolve => {
        const el = document.createElement('div');
        ytBox.innerHTML = '';
        ytBox.appendChild(el);
        yt = new YT.Player(el, {
          width: '100%', height: '100%',
          playerVars: { playsinline: 1, rel: 0, controls: 1 },
          events: {
            onReady: () => resolve(),
            onStateChange: e => {
              if (e.data === 1) started();
              else if (e.data === 2 || e.data === 0) stopped();
              else if (e.data === 5) onChange('loaded');
            },
            // 101 / 150: the owner doesn't allow embedding.
            onError: e => { pending = false; onChange('error', e.data === 101 || e.data === 150 ? 'embed' : 'youtube'); },
          },
        });
      })).catch(err => { ytReady = null; onChange('error', 'youtube'); throw err; });
      return ytReady;
    }

    function setSource(newUrl, s, e) {
      pause();
      url = String(newUrl || '').trim();
      setRange(s, e);
      const id = youtubeId(url);
      ytId = id;
      ytBox.classList.toggle('yt-on', !!id);
      if (id) {
        if (audio.getAttribute('src')) { audio.removeAttribute('src'); audio.load(); }
        ensureYT().then(() => {
          if (ytId !== id || cuedId === id) return;
          cuedId = id;
          yt.cueVideoById({ videoId: id, startSeconds: start });
        }).catch(() => {});
      } else {
        if (yt && yt.stopVideo) { yt.stopVideo(); }
        if (url) {
          if (audio.getAttribute('src') !== url) audio.src = url;
          try { audio.currentTime = start; } catch (err) {}
        } else if (audio.getAttribute('src')) { audio.removeAttribute('src'); audio.load(); }
      }
    }

    function setRange(s, e) {
      start = s > 0 ? +s : 0;
      end = e > 0 && e > start ? +e : null;
    }

    // Play from the start time; stop at the stop time.
    function play(s, e) {
      if (!url) return;
      if (s !== undefined) setRange(s, e);
      clearTimeout(timer); clearTimeout(blockTimer);
      pending = true; armed = false;
      if (ytId) {
        ensureYT().then(() => {
          cuedId = ytId;
          yt.seekTo(start, true);
          yt.playVideo();
          // YouTube doesn't report blocked autoplay; if nothing started, assume it was.
          blockTimer = setTimeout(() => {
            const st = yt.getPlayerState();
            if (pending && st !== 1 && st !== 3) onChange('blocked');
          }, 2500);
        }).catch(() => {});
      } else {
        try { audio.currentTime = start; } catch (err) {}
        audio.play().catch(err => { if (pending) onChange(err.name === 'NotAllowedError' ? 'blocked' : 'error', 'audio'); });
      }
    }

    function pause() {
      pending = false; armed = false;
      clearTimeout(timer); clearTimeout(blockTimer);
      if (ytId) {
        const st = yt && yt.getPlayerState ? yt.getPlayerState() : null;
        if (st === 1 || st === 3) yt.pauseVideo();
      }
      else if (!audio.paused) audio.pause();
    }

    // Stop and go back to the start time.
    function stop() {
      const wasYT = ytId && yt && yt.getPlayerState;
      const st = wasYT ? yt.getPlayerState() : null;
      pause();
      if (ytId) { if (wasYT && (st === 1 || st === 2 || st === 3)) yt.seekTo(start, true); }
      else if (url) { try { audio.currentTime = start; } catch (err) {} }
    }

    return {
      setSource, play, pause, stop,
      time: now,
      duration: () => ytId ? (yt && yt.getDuration ? yt.getDuration() : NaN) : audio.duration,
      isYouTube: () => !!ytId,
    };
  }

  return { youtubeId, youtubeTime, ClipPlayer };
})();
