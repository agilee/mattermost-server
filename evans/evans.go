// Adapted from https://github.com/justinas/alice
package evans

import (
	"github.com/mattermost/mattermost-server/v5/web"
)

type Constructor func(web.ContextHandlerFunc) web.ContextHandlerFunc

type Chain struct {
	constructors []Constructor
}

func New(constructors ...Constructor) Chain {
	return Chain{append(([]Constructor)(nil), constructors...)}
}

func (c Chain) Then(h web.ContextHandlerFunc) web.ContextHandlerFunc {
	for i := range c.constructors {
		h = c.constructors[len(c.constructors)-1-i](h)
	}

	return h
}
