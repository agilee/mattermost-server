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

func requireQueryInSet(name string, set []string) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
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

func requireSystemPermissions(permissions []*model.Permission) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
	return func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
		return func(c *web.Context, w http.ResponseWriter, r *http.Request) {
			for _, permissionID := range permissions {
				if !c.App.SessionHasPermissionTo(*c.App.Session(), permissionID) {
					c.SetPermissionError(permissionID)
					return
				}
			}
			f(c, w, r)
		}
	}
}

func requireLicenseFeatures(features []string) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
	return func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
		return func(c *web.Context, w http.ResponseWriter, r *http.Request) {
			featureMap := c.App.License().Features.ToMap()
			for _, feature := range features {
				val, ok := featureMap[feature]
				if !ok || !val.(bool) {
					c.Err = model.NewAppError(
						"apiMethod", // todo get this from r.Context().Value("api_method") or something...
						"api.error.required_license_feature",
						map[string]interface{}{"feature": feature},
						"",
						http.StatusNotImplemented,
					)
					return
				}
			}
			f(c, w, r)
		}
	}
}

// func requireConfig(conFunc func(config *model.Config) bool) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
// 	return func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
// 		return func(c *web.Context, w http.ResponseWriter, r *http.Request) {
// 			if !conFunc(*c.App.Config()) {
// 				c.Err = model.NewAppError(
// 					"apiMethod", // todo get this from r.Context().Value("api_method") or something...
// 					"api.errors.required_config",
// 					map[string]interface{}{"key"; "", "value": ""}, // TODO: Is this necessary? If so: refactor to support.
// 					"",
// 					http.StatusForbidden
// 				)
// 				return
// 			}
// 			f(c, w, r)
// 		}
// 	}
// }

// func requireFoo(someParam []string) func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
// 	return func(f web.ContextHandlerFunc) web.ContextHandlerFunc {
// 		return func(c *web.Context, w http.ResponseWriter, r *http.Request) {
// 			// Check for foo here
// 			f(c, w, r)
// 		}
// 	}
// }
