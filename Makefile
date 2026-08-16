CARGO ?= cargo
RG ?= rg

CRATES := chalk env reporter commander cli-reporter
PACKAGES := $(addprefix guanghechen-,$(CRATES))
DRY_RUN_TARGETS := $(addprefix dry-run-,$(CRATES))
WORKSPACE_FLAGS := --workspace --all-features --locked

SENSITIVE_FILE_PATTERN := (^|/)(\.env([^/]*)?|\.ssh|\.aws|\.npmrc|\.pypirc|\.netrc|credentials?|secrets?|id_(rsa|dsa|ecdsa|ed25519)|.*\.(pem|p12|pfx|key|http_request|http_response))($$|/)
AUDIT_PATTERNS := \
	-e '/Users/[A-Za-z0-9._-]+/' \
	-e '/home/[A-Za-z0-9._-]+/' \
	-e '[A-Za-z]:\\Users\\[A-Za-z0-9._-]+' \
	-e '\\\\[A-Za-z0-9._-]+\\[A-Za-z0-9.$$_-]+' \
	-e '-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----' \
	-e 'AKIA[0-9A-Z]{16}' \
	-e 'ASIA[0-9A-Z]{16}' \
	-e 'gh[pousr]_[A-Za-z0-9]{20,}' \
	-e 'github_pat_[A-Za-z0-9_]{20,}' \
	-e 'glpat-[A-Za-z0-9_-]{20,}' \
	-e 'xox[baprs]-[A-Za-z0-9-]{10,}' \
	-e 'npm_[A-Za-z0-9]{20,}' \
	-e 'sk-(proj-)?[A-Za-z0-9_-]{20,}'

.DEFAULT_GOAL := help
.NOTPARALLEL:

.PHONY: help audit fmt clippy test build doc check package-list prepublish \
	$(DRY_RUN_TARGETS)

help:
	@printf '%s\n' \
		'make audit             Check for sensitive data and machine-specific paths' \
		'make check             Run all code-quality and build checks' \
		'make prepublish        Run checks and inspect package file lists' \
		'make dry-run-chalk     Dry-run the chalk publish' \
		'make dry-run-env       Dry-run the env publish' \
		'make dry-run-reporter  Dry-run the reporter publish after chalk is indexed' \
		'make dry-run-commander Dry-run the commander publish after chalk and env are indexed' \
		'make dry-run-cli-reporter Dry-run the CLI reporter publish after commander and reporter are indexed'

audit:
	@set -u; \
	command -v "$(RG)" >/dev/null 2>&1 || { printf 'audit requires rg (ripgrep)\n'; exit 1; }; \
	git rev-parse --is-inside-work-tree >/dev/null 2>&1 || { printf 'audit requires a Git worktree\n'; exit 1; }; \
	scan_status=0; \
	risky_paths="$$(git ls-files --cached --others --exclude-standard | \
		$(RG) -i '$(SENSITIVE_FILE_PATTERN)')" || scan_status=$$?; \
	if [ "$$scan_status" -gt 1 ]; then \
		printf 'sensitive-file scan failed\n'; \
		exit "$$scan_status"; \
	fi; \
	if [ -n "$$risky_paths" ]; then \
		printf 'Potentially sensitive files found:\n%s\n' "$$risky_paths"; \
		exit 1; \
	fi; \
	scan_status=0; \
	risky_content="$$( $(RG) --files-with-matches --hidden \
		--glob '!.git' --glob '!.git/**' --glob '!target/**' \
		$(AUDIT_PATTERNS) .)" || scan_status=$$?; \
	if [ "$$scan_status" -gt 1 ]; then \
		printf 'repository-content scan failed\n'; \
		exit "$$scan_status"; \
	fi; \
	if [ -n "$$risky_content" ]; then \
		printf 'Potential sensitive data or machine-specific paths found in:\n%s\n' "$$risky_content"; \
		exit 1; \
	fi

fmt:
	$(CARGO) fmt --all -- --check

clippy:
	$(CARGO) clippy $(WORKSPACE_FLAGS) --all-targets -- -D warnings

test:
	$(CARGO) test $(WORKSPACE_FLAGS) --all-targets

build:
	$(CARGO) build $(WORKSPACE_FLAGS) --release

doc:
	RUSTDOCFLAGS='-D warnings' $(CARGO) doc $(WORKSPACE_FLAGS) --no-deps

check: audit fmt clippy test build doc

package-list:
	@set -eu; \
	for package in $(PACKAGES); do \
		printf '\nPackage contents: %s\n' "$$package"; \
		$(CARGO) package --list --locked -p "$$package"; \
	done

prepublish: check package-list

$(DRY_RUN_TARGETS): dry-run-%: check
	$(CARGO) publish --dry-run --locked -p guanghechen-$*
