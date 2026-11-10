package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCleanURLs(t *testing.T) {
	ts := httptest.NewServer(newMux(NewServer(time.Minute), 0))
	defer ts.Close()
	noFollow := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}

	for _, page := range []string{"/host", "/board", "/player"} {
		res, err := http.Get(ts.URL + page)
		if err != nil {
			t.Fatal(err)
		}
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		if res.StatusCode != 200 || !strings.Contains(string(body), "<title>Jeopardy") {
			t.Errorf("%s: status %d, want the page", page, res.StatusCode)
		}
	}

	res, err := noFollow.Get(ts.URL + "/board.html?code=ABCD")
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusMovedPermanently || res.Header.Get("Location") != "/board?code=ABCD" {
		t.Errorf("/board.html: got %d to %q, want 301 to /board?code=ABCD", res.StatusCode, res.Header.Get("Location"))
	}

	for path, want := range map[string]int{"/": 200, "/style.css": 200, "/nope": 404} {
		res, err := noFollow.Get(ts.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != want {
			t.Errorf("%s: status %d, want %d", path, res.StatusCode, want)
		}
	}
}
