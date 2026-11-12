# Local development shortcuts. Recipes only call npm so they run under sh or cmd.

.DEFAULT_GOAL := dev
.PHONY: dev install test typecheck check build preview extract

# npm rewrites this file on every install, so it tracks whether deps are current.
DEPS := node_modules/.package-lock.json

$(DEPS): package.json package-lock.json
	npm install

install: $(DEPS)

## Start the Vite dev server (http://localhost:5173)
dev: $(DEPS)
	npm run dev

test: $(DEPS)
	npm test

typecheck: $(DEPS)
	npm run typecheck

## Typecheck and test, as before a commit
check: typecheck test

build: $(DEPS)
	npm run build

preview: build
	npm run preview

## Regenerate src/data from the pinned rAthena commit
extract: $(DEPS)
	npm run extract
