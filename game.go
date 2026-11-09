package main

import (
	"encoding/json"
	"math/rand/v2"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// ==================== DATA ====================

type Question struct {
	Clue        string `json:"clue"`
	Answer      string `json:"answer"`
	Value       Int    `json:"value"`
	Answered    bool   `json:"answered"`
	DailyDouble bool   `json:"dailyDouble"`
}

type Category struct {
	Name      string     `json:"name"`
	Questions []Question `json:"questions"`
}

type FinalClue struct {
	Category string `json:"category"`
	Clue     string `json:"clue"`
	Answer   string `json:"answer"`
}

type Board struct {
	Categories    []Category `json:"categories"`
	FinalJeopardy *FinalClue `json:"finalJeopardy,omitempty"`
}

func (b *Board) question(cat, q int) *Question {
	if cat < 0 || cat >= len(b.Categories) || q < 0 || q >= len(b.Categories[cat].Questions) {
		return nil
	}
	return &b.Categories[cat].Questions[q]
}

type Stats struct {
	Buzzes  int `json:"buzzes"`
	Correct int `json:"correct"`
	Wrong   int `json:"wrong"`
}

type Player struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Score    int    `json:"score"`
	Stats    Stats  `json:"stats"`
	canBuzz  bool
	fjWager  *int
	fjAnswer *string
}

type ActiveQuestion struct {
	CatIndex        int     `json:"catIndex"`
	QIndex          int     `json:"qIndex"`
	Category        string  `json:"category"`
	Clue            string  `json:"clue"`
	Answer          string  `json:"answer"`
	Value           int     `json:"value"`
	DailyDouble     bool    `json:"dailyDouble"`
	BuzzTimeLimit   int     `json:"buzzTimeLimit"`
	AnswerTimeLimit int     `json:"answerTimeLimit"`
	DDPlayerID      *string `json:"ddPlayerId"`
	DDWager         *int    `json:"ddWager"`
}

type FinalState struct {
	FinalClue
	wagers   map[string]int
	revealed bool
}

type Game struct {
	Code       string
	Board      Board
	State      string // lobby | playing | question-active | final-jeopardy | ended
	host       *Conn
	members    map[*Conn]bool
	players    []*Player // join order; sorted by score when sent
	active     *ActiveQuestion
	buzzOrder  []string
	buzzTimes  map[string]int64
	openedAt   time.Time
	final      *FinalState
	pickerID   string
	lastActive time.Time
}

func (g *Game) broadcast(event string, data any) {
	for c := range g.members {
		c.emit(event, data)
	}
}

func (g *Game) player(id string) *Player {
	for _, p := range g.players {
		if p.ID == id {
			return p
		}
	}
	return nil
}

// Players sorted by score, highest first.
func (g *Game) standings() []*Player {
	out := append([]*Player(nil), g.players...)
	sort.SliceStable(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	return out
}

type buzzEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	MS   *int64 `json:"ms,omitempty"`
}

func (g *Game) buzzList(withTimes bool) []buzzEntry {
	out := []buzzEntry{}
	for _, id := range g.buzzOrder {
		e := buzzEntry{ID: id, Name: "Unknown"}
		if p := g.player(id); p != nil {
			e.Name = p.Name
		}
		if withTimes {
			if ms, ok := g.buzzTimes[id]; ok {
				e.MS = &ms
			}
		}
		out = append(out, e)
	}
	return out
}

func (g *Game) buzzUpdate() map[string]any {
	first := g.buzzOrder[0]
	name := ""
	if p := g.player(first); p != nil {
		name = p.Name
	}
	return map[string]any{"buzzOrder": g.buzzList(true), "firstBuzzerId": first, "firstBuzzerName": name}
}

func (g *Game) snapshot() map[string]any {
	var final any
	if g.final != nil {
		final = map[string]any{"category": g.final.Category, "revealed": g.final.revealed}
	}
	var picker any
	if g.pickerID != "" {
		picker = g.pickerID
	}
	return map[string]any{
		"code":           g.Code,
		"state":          g.State,
		"board":          g.Board,
		"players":        g.standings(),
		"activeQuestion": g.active,
		"finalJeopardy":  final,
		"pickerId":       picker,
		"buzzOrder":      g.buzzList(false),
	}
}

func (g *Game) closeQuestion(markAnswered bool) {
	if g.active != nil && markAnswered {
		if q := g.Board.question(g.active.CatIndex, g.active.QIndex); q != nil {
			q.Answered = true
		}
	}
	g.active = nil
	g.buzzOrder = nil
	g.State = "playing"
	for _, p := range g.players {
		p.canBuzz = false
	}
}

func (g *Game) scoreEvent(p *Player, value int) map[string]any {
	return map[string]any{"playerId": p.ID, "playerName": p.Name, "value": value, "players": g.standings()}
}

// ==================== EVENTS ====================

func (s *Server) routes() map[string]Handler {
	return map[string]Handler{
		// Anyone
		"create-game": s.createGame,
		"join-board":  s.joinBoard,
		"join-game":   s.joinGame,
		// Players
		"buzz-in":          s.player(buzzIn),
		"submit-wager":     s.player(submitWager),
		"submit-fj-answer": s.player(submitFinalAnswer),
		// Host only
		"start-game":           s.host(startGame),
		"select-question":      s.host(selectQuestion),
		"dd-reveal":            s.host(ddReveal),
		"answer-result":        s.host(answerResult),
		"reveal-answer":        s.host(revealAnswer),
		"dismiss-question":     s.host(dismissQuestion),
		"adjust-score":         s.host(adjustScore),
		"start-final-jeopardy": s.host(startFinal),
		"reveal-final-clue":    s.host(revealFinalClue),
		"final-answer-result":  s.host(finalAnswerResult),
		"end-game":             s.host(endGame),
		"update-board":         s.host(updateBoard),
		"reset-game":           s.host(resetGame),
	}
}

type gameHandler func(g *Game, c *Conn, data json.RawMessage) any
type playerHandler func(g *Game, p *Player, c *Conn, data json.RawMessage)

// host wraps a handler so it only runs for the host of the caller's game.
func (s *Server) host(h gameHandler) Handler {
	return func(c *Conn, data json.RawMessage) any {
		g := c.game
		if g == nil || g.host != c {
			return map[string]string{"error": "No game"} // only sent if the client asked for an ack
		}
		g.lastActive = time.Now()
		return h(g, c, data)
	}
}

// player wraps a handler so it only runs for a player in the caller's game.
func (s *Server) player(h playerHandler) Handler {
	return func(c *Conn, data json.RawMessage) any {
		if c.game == nil {
			return nil
		}
		if p := c.game.player(c.ID); p != nil {
			c.game.lastActive = time.Now()
			h(c.game, p, c, data)
		}
		return nil
	}
}

func (s *Server) enterRoom(c *Conn, g *Game) {
	if c.game != nil && c.game != g {
		s.leaveRoom(c)
	}
	c.game = g
	g.members[c] = true
	g.lastActive = time.Now()
}

func (s *Server) leaveRoom(c *Conn) {
	g := c.game
	if g == nil {
		return
	}
	delete(g.members, c)
	if g.host == c {
		g.host = nil
	}
	for i, p := range g.players {
		if p.ID == c.ID {
			g.players = append(g.players[:i], g.players[i+1:]...)
			g.broadcast("player-left", map[string]any{"playerId": p.ID, "playerName": p.Name, "players": g.standings()})
			break
		}
	}
	c.game = nil
}

func (s *Server) createGame(c *Conn, data json.RawMessage) any {
	var board Board
	if json.Unmarshal(data, &board) != nil || board.Categories == nil {
		return map[string]string{"error": "That board couldn't be read"}
	}
	code := generateCode()
	for i := 0; s.games[code] != nil && i < 100; i++ {
		code = generateCode()
	}
	g := &Game{Code: code, Board: board, State: "lobby", host: c, members: map[*Conn]bool{}}
	s.games[code] = g
	s.enterRoom(c, g)
	return map[string]any{"success": true, "code": code}
}

func (s *Server) joinBoard(c *Conn, data json.RawMessage) any {
	var code string
	json.Unmarshal(data, &code)
	g := s.games[code]
	if g == nil {
		return map[string]string{"error": "Game not found"}
	}
	s.enterRoom(c, g)
	return map[string]any{"success": true, "game": g.snapshot()}
}

func (s *Server) joinGame(c *Conn, data json.RawMessage) any {
	var req struct{ Code, Name string }
	json.Unmarshal(data, &req)
	g := s.games[req.Code]
	if g == nil {
		return map[string]string{"error": "Game not found"}
	}
	name := truncate(strings.TrimSpace(req.Name), 20)
	if name == "" {
		return map[string]string{"error": "Name required"}
	}
	for _, p := range g.players {
		if strings.EqualFold(p.Name, name) {
			name += strconv.Itoa(rand.IntN(100))
			break
		}
	}
	if p := g.player(c.ID); p != nil && c.game == g {
		return map[string]any{"success": true, "name": p.Name, "game": g.snapshot()}
	}
	s.enterRoom(c, g)
	g.players = append(g.players, &Player{ID: c.ID, Name: name})
	g.broadcast("players-update", g.standings())
	return map[string]any{"success": true, "name": name, "game": g.snapshot()}
}

func startGame(g *Game, c *Conn, _ json.RawMessage) any {
	g.State = "playing"
	g.broadcast("game-started", map[string]any{"board": g.Board})
	return nil
}

func selectQuestion(g *Game, c *Conn, data json.RawMessage) any {
	var req struct{ CatIndex, QIndex, BuzzTimeLimit, AnswerTimeLimit Int }
	json.Unmarshal(data, &req)
	if g.State != "playing" {
		return nil
	}
	q := g.Board.question(int(req.CatIndex), int(req.QIndex))
	if q == nil || q.Answered {
		return nil
	}
	g.active = &ActiveQuestion{
		CatIndex:        int(req.CatIndex),
		QIndex:          int(req.QIndex),
		Category:        g.Board.Categories[req.CatIndex].Name,
		Clue:            q.Clue,
		Answer:          q.Answer,
		Value:           int(q.Value),
		DailyDouble:     q.DailyDouble,
		BuzzTimeLimit:   clamp(or(int(req.BuzzTimeLimit), 30), 5, 120),
		AnswerTimeLimit: clamp(or(int(req.AnswerTimeLimit), 10), 5, 60),
	}
	g.buzzOrder = nil
	g.buzzTimes = map[string]int64{}
	g.openedAt = time.Now()
	g.State = "question-active"
	// Daily Doubles aren't buzzed: the host picks the player and wager.
	for _, p := range g.players {
		p.canBuzz = !q.DailyDouble
	}
	g.broadcast("question-active", g.active)
	return nil
}

func ddReveal(g *Game, c *Conn, data json.RawMessage) any {
	var req struct {
		PlayerID string `json:"playerId"`
		Wager    Int    `json:"wager"`
	}
	json.Unmarshal(data, &req)
	if g.active == nil || !g.active.DailyDouble {
		return nil
	}
	p := g.player(req.PlayerID)
	if p == nil {
		return nil
	}
	wager := clamp(or(int(req.Wager), 5), 5, max(1000, p.Score))
	g.active.DDPlayerID = &p.ID
	g.active.DDWager = &wager
	g.broadcast("dd-revealed", map[string]any{
		"playerId": p.ID, "playerName": p.Name, "wager": wager,
		"clue": g.active.Clue, "answer": g.active.Answer,
	})
	return nil
}

func buzzIn(g *Game, p *Player, c *Conn, _ json.RawMessage) {
	if g.State != "question-active" || !p.canBuzz {
		return
	}
	for _, id := range g.buzzOrder {
		if id == p.ID {
			return
		}
	}
	g.buzzOrder = append(g.buzzOrder, p.ID)
	g.buzzTimes[p.ID] = time.Since(g.openedAt).Milliseconds()
	p.Stats.Buzzes++
	g.broadcast("buzz-update", g.buzzUpdate())
}

func answerResult(g *Game, c *Conn, data json.RawMessage) any {
	var req struct{ Correct bool }
	json.Unmarshal(data, &req)
	if g.active == nil {
		return nil
	}

	if g.active.DailyDouble {
		if g.active.DDPlayerID == nil || g.active.DDWager == nil {
			return nil
		}
		p := g.player(*g.active.DDPlayerID)
		if p == nil {
			return nil
		}
		wager := *g.active.DDWager
		if req.Correct {
			p.Score += wager
			p.Stats.Correct++
			g.pickerID = p.ID
		} else {
			p.Score -= wager
			p.Stats.Wrong++
		}
		ev := g.scoreEvent(p, wager)
		g.closeQuestion(true)
		g.broadcast(map[bool]string{true: "answer-correct", false: "answer-wrong"}[req.Correct], ev)
		g.broadcast("question-closed", nil)
		return nil
	}

	if len(g.buzzOrder) == 0 {
		return nil
	}
	p := g.player(g.buzzOrder[0])
	if p == nil {
		return nil
	}
	value := g.active.Value
	if req.Correct {
		p.Score += value
		p.Stats.Correct++
		g.pickerID = p.ID
		ev := g.scoreEvent(p, value)
		g.closeQuestion(true)
		g.broadcast("answer-correct", ev)
		g.broadcast("question-closed", nil)
		return nil
	}
	// Wrong: dock them and hand the clue to the next buzzer in line.
	p.Score -= value
	p.Stats.Wrong++
	p.canBuzz = false
	g.buzzOrder = g.buzzOrder[1:]
	g.broadcast("answer-wrong", g.scoreEvent(p, value))
	if len(g.buzzOrder) > 0 {
		g.broadcast("buzz-update", g.buzzUpdate())
	}
	return nil
}

func revealAnswer(g *Game, c *Conn, _ json.RawMessage) any {
	if g.active != nil {
		g.broadcast("answer-revealed", map[string]any{"answer": g.active.Answer})
	}
	return nil
}

func dismissQuestion(g *Game, c *Conn, _ json.RawMessage) any {
	g.closeQuestion(true)
	g.broadcast("question-closed", nil)
	return nil
}

func adjustScore(g *Game, c *Conn, data json.RawMessage) any {
	var req struct {
		PlayerID string `json:"playerId"`
		Delta    Int    `json:"delta"`
	}
	json.Unmarshal(data, &req)
	if p := g.player(req.PlayerID); p != nil {
		p.Score += int(req.Delta)
		g.broadcast("players-update", g.standings())
	}
	return nil
}

// ==================== FINAL JEOPARDY ====================

func startFinal(g *Game, c *Conn, data json.RawMessage) any {
	var clue FinalClue
	json.Unmarshal(data, &clue)
	g.State = "final-jeopardy"
	g.final = &FinalState{FinalClue: clue, wagers: map[string]int{}}
	g.active = nil
	g.buzzOrder = nil
	for _, p := range g.players {
		p.canBuzz, p.fjWager, p.fjAnswer = false, nil, nil
	}
	g.broadcast("final-jeopardy-started", map[string]any{"category": clue.Category, "players": g.standings()})
	return nil
}

func submitWager(g *Game, p *Player, c *Conn, data json.RawMessage) {
	var req struct{ Amount Int }
	json.Unmarshal(data, &req)
	if g.State != "final-jeopardy" {
		return
	}
	wager := clamp(int(req.Amount), 0, max(0, p.Score))
	p.fjWager = &wager
	g.final.wagers[p.ID] = wager
	g.broadcast("fj-wager-received", map[string]any{
		"playerId": p.ID, "playerName": p.Name,
		"wageredCount": len(g.final.wagers), "totalPlayers": len(g.players),
	})
	c.emit("fj-wager-confirmed", map[string]any{"wager": wager})
}

// Players type their final answer; only the host sees the text.
func submitFinalAnswer(g *Game, p *Player, c *Conn, data json.RawMessage) {
	var req struct{ Answer string }
	json.Unmarshal(data, &req)
	if g.State != "final-jeopardy" || !g.final.revealed {
		return
	}
	answer := truncate(strings.TrimSpace(req.Answer), 120)
	p.fjAnswer = &answer
	c.emit("fj-answer-confirmed", map[string]any{"answer": answer})
	if g.host != nil {
		g.host.emit("fj-answer-received", map[string]any{"playerId": p.ID, "playerName": p.Name, "answer": answer})
	}
	answered := 0
	for _, pl := range g.players {
		if pl.fjAnswer != nil {
			answered++
		}
	}
	g.broadcast("fj-answer-count", map[string]any{"answered": answered, "totalPlayers": len(g.players)})
}

func revealFinalClue(g *Game, c *Conn, _ json.RawMessage) any {
	if g.final != nil {
		g.final.revealed = true
		g.broadcast("fj-clue-revealed", map[string]any{"clue": g.final.Clue})
	}
	return nil
}

func finalAnswerResult(g *Game, c *Conn, data json.RawMessage) any {
	var req struct {
		PlayerID string `json:"playerId"`
		Correct  bool   `json:"correct"`
	}
	json.Unmarshal(data, &req)
	p := g.player(req.PlayerID)
	if g.final == nil || p == nil {
		return nil
	}
	wager := 0
	if p.fjWager != nil {
		wager = *p.fjWager
	}
	if req.Correct {
		p.Score += wager
	} else {
		p.Score -= wager
	}
	g.broadcast("fj-answer-result", map[string]any{
		"playerId": p.ID, "playerName": p.Name, "correct": req.Correct,
		"wager": wager, "newScore": p.Score, "players": g.standings(),
	})
	return nil
}

func endGame(g *Game, c *Conn, _ json.RawMessage) any {
	g.State = "ended"
	var answer, category any
	if g.final != nil {
		answer, category = g.final.Answer, g.final.Category
	}
	g.broadcast("game-ended", map[string]any{"players": g.standings(), "finalAnswer": answer, "finalCategory": category})
	return nil
}

// ==================== EDIT / RESET ====================

// Host edited the board mid-game: take the new text, keep what's been played.
func updateBoard(g *Game, c *Conn, data json.RawMessage) any {
	var b Board
	if json.Unmarshal(data, &b) != nil || b.Categories == nil {
		return map[string]string{"error": "No game"}
	}
	for ci, cat := range b.Categories {
		if ci >= len(g.Board.Categories) {
			break
		}
		live := &g.Board.Categories[ci]
		live.Name = cat.Name
		for qi, q := range cat.Questions {
			lq := g.Board.question(ci, qi)
			if lq == nil {
				break
			}
			if g.active != nil && g.active.CatIndex == ci && g.active.QIndex == qi {
				continue
			}
			lq.Clue, lq.Answer = q.Clue, q.Answer
			if !lq.Answered {
				lq.DailyDouble = q.DailyDouble
			}
		}
	}
	if b.FinalJeopardy != nil {
		g.Board.FinalJeopardy = b.FinalJeopardy
	}
	g.broadcast("board-updated", map[string]any{"board": g.Board})
	return map[string]any{"success": true, "board": g.Board}
}

func resetGame(g *Game, c *Conn, data json.RawMessage) any {
	var b Board
	if json.Unmarshal(data, &b) == nil && b.Categories != nil {
		g.Board = b
	}
	g.active = nil
	g.buzzOrder = nil
	g.final = nil
	g.State = "playing"
	for ci := range g.Board.Categories {
		for qi := range g.Board.Categories[ci].Questions {
			g.Board.Categories[ci].Questions[qi].Answered = false
		}
	}
	for _, p := range g.players {
		p.Score, p.Stats, p.canBuzz, p.fjWager, p.fjAnswer = 0, Stats{}, false, nil, nil
	}
	g.broadcast("game-reset", map[string]any{"board": g.Board, "players": g.standings()})
	return nil
}

// sweepIdleGames forgets rooms nobody has touched in a while.
func (s *Server) sweepIdleGames(every, maxIdle time.Duration) {
	for range time.Tick(every) {
		s.mu.Lock()
		for code, g := range s.games {
			if time.Since(g.lastActive) > maxIdle {
				delete(s.games, code)
			}
		}
		s.mu.Unlock()
	}
}

// ==================== HELPERS ====================

func generateCode() string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, 4)
	for i := range b {
		b[i] = chars[rand.IntN(len(chars))]
	}
	return string(b)
}

// Int decodes a JSON number or numeric string ("500", "500px") like JS
// parseInt; anything else becomes 0.
type Int int

func (n *Int) UnmarshalJSON(b []byte) error {
	var f float64
	if json.Unmarshal(b, &f) == nil {
		*n = Int(f)
		return nil
	}
	var s string
	json.Unmarshal(b, &s)
	s = strings.TrimSpace(s)
	end := 0
	for end < len(s) && (unicode.IsDigit(rune(s[end])) || (end == 0 && (s[0] == '-' || s[0] == '+'))) {
		end++
	}
	v, _ := strconv.Atoi(s[:end])
	*n = Int(v)
	return nil
}

func or(v, def int) int {
	if v == 0 {
		return def
	}
	return v
}

func clamp(v, lo, hi int) int { return max(lo, min(v, hi)) }

func truncate(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}
