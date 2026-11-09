package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/coder/websocket"
)

// Wire format (JSON text frames):
//
//	client -> server  {"e": "event-name", "d": <payload>, "ack": 7}
//	server -> client  {"e": "event-name", "d": <payload>}
//	server -> client  {"ack": 7, "d": <response>}
//
// On connect the server sends {"e": "hello", "d": {"id": "<conn id>"}}.
type inMsg struct {
	Event string          `json:"e"`
	Data  json.RawMessage `json:"d"`
	Ack   *int            `json:"ack"`
}

type outMsg struct {
	Event string `json:"e,omitempty"`
	Data  any    `json:"d"`
	Ack   *int   `json:"ack,omitempty"`
}

// Conn is one connected browser tab (host, TV board, or player).
type Conn struct {
	ID     string
	out    chan []byte
	cancel context.CancelFunc
	game   *Game // room this connection belongs to, if any
}

func (c *Conn) send(m outMsg) {
	b, err := json.Marshal(m)
	if err != nil {
		log.Printf("marshal %q: %v", m.Event, err)
		return
	}
	select {
	case c.out <- b:
	default: // client isn't keeping up; drop it
		c.cancel()
	}
}

func (c *Conn) emit(event string, data any) { c.send(outMsg{Event: event, Data: data}) }

// Handler runs an event for a connection while the server lock is held.
// A non-nil return value is sent back as the ack response.
type Handler func(c *Conn, data json.RawMessage) any

// Server owns every game. One mutex guards all game state: games are tiny
// and events are rare, so there's nothing to gain from finer locking.
type Server struct {
	mu          sync.Mutex
	games       map[string]*Game
	handlers    map[string]Handler
	pingTimeout time.Duration
}

func NewServer(pingTimeout time.Duration) *Server {
	s := &Server{games: map[string]*Game{}, pingTimeout: pingTimeout}
	s.handlers = s.routes()
	return s
}

func (s *Server) HandleWS(w http.ResponseWriter, r *http.Request) {
	ws, err := websocket.Accept(w, r, nil)
	if err != nil {
		return
	}
	defer ws.CloseNow()
	ws.SetReadLimit(1 << 20)

	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()
	c := &Conn{ID: newID(), out: make(chan []byte, 256), cancel: cancel}

	go writeLoop(ctx, ws, c.out)
	go s.pingLoop(ctx, ws, cancel)

	c.emit("hello", map[string]string{"id": c.ID})
	for {
		_, b, err := ws.Read(ctx)
		if err != nil {
			break
		}
		var m inMsg
		if json.Unmarshal(b, &m) != nil {
			continue
		}
		s.dispatch(c, m)
	}
	s.mu.Lock()
	s.leaveRoom(c)
	s.mu.Unlock()
}

func (s *Server) dispatch(c *Conn, m inMsg) {
	h, ok := s.handlers[m.Event]
	if !ok {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if resp := h(c, m.Data); resp != nil && m.Ack != nil {
		c.send(outMsg{Ack: m.Ack, Data: resp})
	}
}

func writeLoop(ctx context.Context, ws *websocket.Conn, out <-chan []byte) {
	for {
		select {
		case <-ctx.Done():
			return
		case b := <-out:
			wctx, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := ws.Write(wctx, websocket.MessageText, b)
			cancel()
			if err != nil {
				return
			}
		}
	}
}

// Phones lock their screens and background tabs get throttled, so give
// clients a generous window to answer a ping before treating them as gone.
func (s *Server) pingLoop(ctx context.Context, ws *websocket.Conn, cancel context.CancelFunc) {
	t := time.NewTicker(25 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			pctx, pcancel := context.WithTimeout(ctx, s.pingTimeout)
			err := ws.Ping(pctx)
			pcancel()
			if err != nil {
				cancel()
				return
			}
		}
	}
}

func newID() string {
	b := make([]byte, 10)
	rand.Read(b)
	return hex.EncodeToString(b)
}
