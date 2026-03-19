.PHONY: up down restart deploy fresh logs open help

# ── Config ────────────────────────────────────────────────────────────────────
DASHBOARD := http://localhost:8080/dashboard.html
DEMO      := http://localhost:8080/demo-publisher.html

# ── Targets ───────────────────────────────────────────────────────────────────

up:                          ## Start Ganache + nginx
	docker compose up -d

down:                        ## Stop all containers
	docker compose down

deploy:                      ## Compile & deploy OxAds.sol → patches frontend files
	node deploy.js

fresh: down up deploy        ## Full reset: stop → start → deploy

logs:                        ## Stream Ganache logs
	docker compose logs -f ganache

open:                        ## Open dashboard in browser
	xdg-open $(DASHBOARD) 2>/dev/null || open $(DASHBOARD)

demo:                        ## Open demo publisher site in browser
	xdg-open $(DEMO) 2>/dev/null || open $(DEMO)

help:                        ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*##"}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
