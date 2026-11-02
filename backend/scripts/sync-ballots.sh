#!/usr/bin/env bash
# Local (launchd) automation for the ballot pull. Replaces the GitHub Actions
# workflow, which could not reach the read-only RDS endpoint.
#
# Runs load-ballots.mjs against the Carolina Elections MySQL endpoint, then
# applies the generated ballots-load.sql to Supabase through psql. Credentials
# come from ~/.config/carolina_elections/{mysql,supabase}.env (chmod 600).
set -euo pipefail

REPO="/Users/mihirkale/repos/locke/carolina_elections"
export PATH="/opt/homebrew/opt/mysql-client/bin:/opt/homebrew/bin:$PATH"

# Load credentials
set -a
. "$HOME/.config/carolina_elections/mysql.env"
. "$HOME/.config/carolina_elections/supabase.env"
set +a

cd "$REPO"
node backend/scripts/load-ballots.mjs

PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "postgresql://postgres.${SUPABASE_PROJECT_REF}@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
  -f ballots-load.sql

echo "ballot sync complete: $(date)"
