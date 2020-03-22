package api4

import (
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/web"
)

func requireQueryParam(name string) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
	return func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
		return func(c *web.Context, w http.ResponseWriter, r *http.Request) {
			val := r.URL.Query().Get(name)
			if val == "" {
				c.Err = model.NewAppError(
					"apiMethod", // todo get this from r.Context().Value("api_method") or something...
					"api.error.query_presence",
					map[string]interface{}{"key": name, "val": val},
					"",
					http.StatusNotImplemented,
				)
				return
			}
			f(c, w, r)
		}
	}
}

func queryInSet(name string, set []string) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
	return func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
		return func(c *web.Context, w http.ResponseWriter, r *http.Request) {
			val := r.URL.Query().Get(name)
			inSet := false
			for _, setVal := range set {
				if setVal == val {
					inSet = true
				}
			}
			if !inSet {
				c.Err = model.NewAppError(
					"apiMethod", // todo get this from r.Context().Value("api_method") or something...
					"api.error.required_set",
					map[string]interface{}{"key": name, "val": val, "set": set},
					"",
					http.StatusNotImplemented,
				)
				return
			}
			f(c, w, r)
		}
	}
}
