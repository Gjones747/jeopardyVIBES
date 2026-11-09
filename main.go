// Command jeopardy serves the multiplayer Jeopardy game: static pages from
// public/ and a WebSocket endpoint at /ws that runs the game rooms.
package main

import (
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

//go:embed public
var publicFiles embed.FS

func main() {
	port := envInt("PORT", 2999)
	pingTimeout := time.Duration(envInt("PING_TIMEOUT_MS", 60000)) * time.Millisecond

	ln, err := net.Listen("tcp", ":"+strconv.Itoa(port))
	if err != nil {
		log.Fatal(err)
	}
	port = ln.Addr().(*net.TCPAddr).Port

	srv := NewServer(pingTimeout)
	go srv.sweepIdleGames(10*time.Minute, 6*time.Hour)

	log.Printf("Jeopardy server running at http://localhost:%d", port)
	log.Fatal(http.Serve(ln, newMux(srv, port)))
}

func newMux(srv *Server, port int) *http.ServeMux {
	static, err := fs.Sub(publicFiles, "public")
	if err != nil {
		panic(err)
	}
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServerFS(static))
	mux.HandleFunc("/ws", srv.HandleWS)
	// LAN address so the TV can show a join link players can actually reach.
	mux.HandleFunc("/api/info", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"port": port, "lanAddresses": lanAddresses()})
	})
	return mux
}

func lanAddresses() []string {
	addrs := []string{}
	ifaces, _ := net.InterfaceAddrs()
	for _, a := range ifaces {
		if ipnet, ok := a.(*net.IPNet); ok && !ipnet.IP.IsLoopback() && ipnet.IP.To4() != nil {
			addrs = append(addrs, ipnet.IP.String())
		}
	}
	return addrs
}

func envInt(key string, def int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return v
	}
	return def
}
