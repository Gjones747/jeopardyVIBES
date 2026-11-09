// Tiny Socket.IO-style client over a plain WebSocket (see ws.go for the wire format).
//   const socket = io();
//   socket.on('event', fn);  socket.emit('event', payload, ackFn);
// Emits made while offline are queued; the socket reconnects on its own and
// fires 'connect' / 'disconnect' like Socket.IO does.
(function () {
  window.io = function io() {
    const handlers = {}, acks = {}, queue = [];
    let ws, seq = 0, retry = 500;

    const socket = {
      id: null,
      connected: false,
      on(event, fn) { (handlers[event] ||= []).push(fn); return socket; },
      emit(event, ...args) {
        const msg = { e: event };
        if (typeof args[args.length - 1] === 'function') { msg.ack = ++seq; acks[msg.ack] = args.pop(); }
        if (args.length) msg.d = args[0];
        const frame = JSON.stringify(msg);
        socket.connected ? ws.send(frame) : queue.push(frame);
        return socket;
      },
    };

    const fire = (event, data) => (handlers[event] || []).forEach(fn => fn(data));

    function open() {
      ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.ack != null) {
          const fn = acks[m.ack];
          delete acks[m.ack];
          if (fn) fn(m.d);
        } else if (m.e === 'hello') {
          socket.id = m.d.id;
          socket.connected = true;
          retry = 500;
          queue.splice(0).forEach(f => ws.send(f));
          fire('connect');
        } else {
          fire(m.e, m.d);
        }
      };
      ws.onclose = () => {
        const was = socket.connected;
        socket.connected = false;
        if (was) fire('disconnect');
        setTimeout(open, retry);
        retry = Math.min(retry * 2, 5000);
      };
    }

    open();
    return socket;
  };
})();
