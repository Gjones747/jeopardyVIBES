package main

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

type client struct {
	t   *testing.T
	ws  *websocket.Conn
	id  string
	seq int
}

type frame struct {
	E   string          `json:"e"`
	D   json.RawMessage `json:"d"`
	Ack *int            `json:"ack"`
}

func dial(t *testing.T, url string) *client {
	t.Helper()
	ws, _, err := websocket.Dial(context.Background(), strings.Replace(url, "http", "ws", 1)+"/ws", nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ws.CloseNow() })
	c := &client{t: t, ws: ws}
	var hello struct{ ID string }
	json.Unmarshal(c.next("hello").D, &hello)
	c.id = hello.ID
	return c
}

func (c *client) emit(event string, data any) int {
	c.seq++
	b, _ := json.Marshal(map[string]any{"e": event, "d": data, "ack": c.seq})
	if err := c.ws.Write(context.Background(), websocket.MessageText, b); err != nil {
		c.t.Fatal(err)
	}
	return c.seq
}

// next reads frames until one matches the event name (or "ack" for any ack).
func (c *client) next(event string) frame {
	c.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	for {
		_, b, err := c.ws.Read(ctx)
		if err != nil {
			c.t.Fatalf("waiting for %q: %v", event, err)
		}
		var f frame
		json.Unmarshal(b, &f)
		if f.E == event || (event == "ack" && f.Ack != nil) {
			return f
		}
	}
}

func (c *client) call(event string, data any, out any) {
	c.t.Helper()
	c.emit(event, data)
	json.Unmarshal(c.next("ack").D, out)
}

func testBoard() Board {
	b := Board{FinalJeopardy: &FinalClue{"Space", "Red planet", "Mars"}}
	for i := 0; i < 2; i++ {
		cat := Category{Name: "Cat"}
		for v := 200; v <= 400; v += 200 {
			cat.Questions = append(cat.Questions, Question{Clue: "c", Answer: "a", Value: Int(v)})
		}
		b.Categories = append(b.Categories, cat)
	}
	b.Categories[1].Questions[0].DailyDouble = true
	return b
}

type playersMsg struct {
	Players []Player `json:"players"`
}

func TestFullGame(t *testing.T) {
	ts := httptest.NewServer(newMux(NewServer(time.Minute), 0))
	defer ts.Close()

	host := dial(t, ts.URL)
	var created struct{ Code string }
	host.call("create-game", testBoard(), &created)
	if len(created.Code) != 4 {
		t.Fatalf("bad code %q", created.Code)
	}

	alice, bob := dial(t, ts.URL), dial(t, ts.URL)
	var joined struct{ Name string }
	alice.call("join-game", map[string]string{"code": created.Code, "name": "Alice"}, &joined)
	bob.call("join-game", map[string]string{"code": created.Code, "name": "alice"}, &joined)
	if joined.Name == "alice" {
		t.Fatal("duplicate name was not changed")
	}

	var notFound struct{ Error string }
	bob.call("join-game", map[string]string{"code": "ZZZZ", "name": "x"}, &notFound)
	if notFound.Error != "Game not found" {
		t.Fatalf("got %+v", notFound)
	}

	// Players can't run host events.
	alice.emit("start-game", nil)
	host.emit("start-game", nil)
	host.next("game-started")

	// Bob buzzes wrong, Alice right.
	host.emit("select-question", map[string]any{"catIndex": 0, "qIndex": 1, "buzzTimeLimit": "20"})
	var q ActiveQuestion
	json.Unmarshal(alice.next("question-active").D, &q)
	if q.Value != 400 || q.BuzzTimeLimit != 20 || q.AnswerTimeLimit != 10 {
		t.Fatalf("question %+v", q)
	}
	bob.emit("buzz-in", nil)
	host.next("buzz-update")
	alice.emit("buzz-in", nil)
	host.next("buzz-update")
	host.emit("answer-result", map[string]bool{"correct": false})
	host.next("answer-wrong")
	host.next("buzz-update")
	host.emit("answer-result", map[string]bool{"correct": true})
	var pm playersMsg
	json.Unmarshal(host.next("answer-correct").D, &pm)
	if pm.Players[0].ID != alice.id || pm.Players[0].Score != 400 || pm.Players[1].Score != -400 {
		t.Fatalf("scores %+v", pm.Players)
	}
	host.next("question-closed")

	// Daily Double: wager clamps to max(1000, score).
	host.emit("select-question", map[string]any{"catIndex": 1, "qIndex": 0})
	host.next("question-active")
	host.emit("dd-reveal", map[string]any{"playerId": alice.id, "wager": 5000})
	var dd struct{ Wager int }
	json.Unmarshal(host.next("dd-revealed").D, &dd)
	if dd.Wager != 1000 {
		t.Fatalf("dd wager %d", dd.Wager)
	}
	host.emit("answer-result", map[string]bool{"correct": true})
	json.Unmarshal(host.next("answer-correct").D, &pm)
	if pm.Players[0].Score != 1400 {
		t.Fatalf("after DD %+v", pm.Players)
	}

	// Board TV joins mid-game and sees played clues.
	tv := dial(t, ts.URL)
	var snap struct {
		Game struct {
			State string
			Board Board
		}
	}
	tv.call("join-board", created.Code, &snap)
	if !snap.Game.Board.Categories[0].Questions[1].Answered || snap.Game.State != "playing" {
		t.Fatalf("snapshot %+v", snap.Game)
	}

	// Final Jeopardy.
	host.emit("start-final-jeopardy", FinalClue{"Space", "Red planet", "Mars"})
	alice.next("final-jeopardy-started")
	alice.emit("submit-wager", map[string]any{"amount": "9999"})
	var wc struct{ Wager int }
	json.Unmarshal(alice.next("fj-wager-confirmed").D, &wc)
	if wc.Wager != 1400 {
		t.Fatalf("fj wager %d", wc.Wager)
	}
	host.emit("reveal-final-clue", nil)
	alice.next("fj-clue-revealed")
	alice.emit("submit-fj-answer", map[string]string{"answer": "  Mars  "})
	var fa struct{ Answer string }
	json.Unmarshal(host.next("fj-answer-received").D, &fa)
	if fa.Answer != "Mars" {
		t.Fatalf("fj answer %q", fa.Answer)
	}
	host.emit("final-answer-result", map[string]any{"playerId": alice.id, "correct": true})
	var res struct{ NewScore int }
	json.Unmarshal(host.next("fj-answer-result").D, &res)
	if res.NewScore != 2800 {
		t.Fatalf("final score %d", res.NewScore)
	}

	// A player leaving is announced.
	bob.ws.CloseNow()
	json.Unmarshal(host.next("player-left").D, &pm)
	if len(pm.Players) != 1 {
		t.Fatalf("players after leave %+v", pm.Players)
	}

	host.emit("reset-game", nil)
	json.Unmarshal(host.next("game-reset").D, &pm)
	if pm.Players[0].Score != 0 {
		t.Fatalf("after reset %+v", pm.Players)
	}
}

func TestUpdateBoardKeepsPlayedClues(t *testing.T) {
	ts := httptest.NewServer(newMux(NewServer(time.Minute), 0))
	defer ts.Close()
	host := dial(t, ts.URL)
	var created struct{ Code string }
	host.call("create-game", testBoard(), &created)
	host.emit("start-game", nil)
	host.emit("select-question", map[string]any{"catIndex": 0, "qIndex": 0})
	host.emit("dismiss-question", nil)
	host.next("question-closed")

	edited := testBoard()
	edited.Categories[0].Name = "Renamed"
	edited.Categories[0].Questions[1].Clue = "new clue"
	var out struct {
		Success bool
		Board   Board
	}
	host.call("update-board", edited, &out)
	c := out.Board.Categories[0]
	if !out.Success || c.Name != "Renamed" || c.Questions[1].Clue != "new clue" || !c.Questions[0].Answered {
		t.Fatalf("update-board %+v", out)
	}

	// Non-hosts get an error ack.
	other := dial(t, ts.URL)
	var denied struct{ Error string }
	other.call("update-board", edited, &denied)
	if denied.Error == "" {
		t.Fatal("non-host update-board was allowed")
	}
}

func TestIntParsesLikeParseInt(t *testing.T) {
	for in, want := range map[string]int{`500`: 500, `"300"`: 300, `"12abc"`: 12, `"abc"`: 0, `null`: 0, `-5`: -5, `7.9`: 7} {
		var n Int
		json.Unmarshal([]byte(in), &n)
		if int(n) != want {
			t.Errorf("%s: got %d want %d", in, n, want)
		}
	}
}
