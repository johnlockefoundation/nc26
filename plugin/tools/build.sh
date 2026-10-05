#!/usr/bin/env bash
#
# Builds the distributable zip from this repository's frontend and then verifies
# the artifact that actually ships.
#
# plugin/ is the WordPress half and frontend/ the Pages half, in one repository.
# The plugin consumes the frontend's built output rather than reshaping it, so
# the two cannot drift in shape; keeping them together is what makes that cheap.
# NC26_DIR still overrides the frontend location for anyone who checks the two
# halves out separately.
#
# Two things this deliberately does the way property-tax-bill does them:
#
#   * Everything uses absolute paths. A relative path in an earlier build step
#     wrote a zip somewhere other than where it belonged, leaving a stale package
#     in place while the source moved on. The version is re-read out of the
#     extracted zip at the end so that class of mistake cannot pass silently.
#
#   * The checks run against the EXTRACTED ZIP, not the source tree. A bundler
#     never executes the code it emits, so "the build was green" only ever meant
#     the artifact was well-formed. What ships is the zip, so the zip is what
#     gets checked -- including being rendered by PHP below.
#
# Usage: bash tools/build.sh

set -euo pipefail

PLUGIN="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# The artifact lands at the repository's top-level dist/, beside frontend/dist/,
# so one place holds every build output rather than each half keeping its own.
DIST="$PLUGIN/../dist"
STAGE="${TMPDIR:-/tmp}/jce-build-$$"
VERIFY="${TMPDIR:-/tmp}/jce-verify-$$"
PLUGIN_SLUG="carolina-election-map"
FRONTEND="${NC26_DIR:-$PLUGIN/..}"
ZIP_NAME="$PLUGIN_SLUG.zip"
trap 'rm -rf "$STAGE" "$VERIFY"' EXIT

die() { echo "  FAIL: $*" >&2; exit 1; }

# --- frontend present? -----------------------------------------------------
if [ ! -f "$FRONTEND/frontend/package.json" ]; then
  die "nc26 frontend not found at $FRONTEND"
  die "expected frontend/ beside plugin/, or set NC26_DIR=/path/to/nc26"
fi

VERSION="$(grep -m1 ' \* Version:' "$PLUGIN/$PLUGIN_SLUG.php" | awk '{print $3}')"
[ -n "$VERSION" ] || die "could not read a version from the plugin header"
echo "building $PLUGIN_SLUG $VERSION"
echo "  frontend: $FRONTEND"

# --- build the frontend ----------------------------------------------------
# The plugin target is the one that strips every volatile key: polls, markets,
# money, state_funds, vitals and news are all read live from Supabase, so
# baking any of them into a shipped file would give a figure no timestamp that
# reads as live for as long as the plugin is installed.
#
# nc26 has to be ingested before it can be exported. backend/db/ and
# frontend/public/data/ are both gitignored, so a clean checkout has neither the
# database nor the generated reference layer, and export-reference.mjs refuses to
# run rather than emitting an empty one. Same sequence the Pages deploy uses.
echo "  building the plugin target in nc26..."
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "  npm ci (first run)"
  ( cd "$FRONTEND" && npm ci ) >/dev/null 2>&1 || die "npm ci failed in nc26"
fi
( cd "$FRONTEND" && npm run ingest ) >/dev/null 2>&1 \
  || die "ingest failed in nc26; run it there to see the error"
( cd "$FRONTEND" && npm run build:plugin -w frontend ) >/dev/null 2>&1 \
  || die "the nc26 plugin build failed; run it there to see the error"

DISTDIR="$FRONTEND/frontend/dist"
[ -f "$DISTDIR/jce-app.js" ] || die "no jce-app.js in $DISTDIR"

# --- stage -----------------------------------------------------------------
# The bundle resolves its own directory from document.currentScript, so the zip
# layout has to put jce-app.js, jce-style.css, assets/ and data/ under one
# directory that the plugin enqueues by plugins_url(). Nesting it one level deep
# under assets/ is what makes that URL match on any install path.
mkdir -p "$STAGE/$PLUGIN_SLUG/assets/$PLUGIN_SLUG"
rsync -a \
  --exclude demo-data \
  --exclude index.html \
  "$DISTDIR/" "$STAGE/$PLUGIN_SLUG/assets/$PLUGIN_SLUG/"

# demo-data/ is the Pages demo payload and index.html is the Pages shell.
# Neither is read by the plugin: grep -r demo-data jce-app.js returns nothing.
if [ -d "$STAGE/$PLUGIN_SLUG/assets/$PLUGIN_SLUG/demo-data" ]; then
  die "demo-data/ was staged; the plugin never reads it"
fi

cp "$PLUGIN/$PLUGIN_SLUG.php" "$STAGE/$PLUGIN_SLUG/"
mkdir -p "$STAGE/$PLUGIN_SLUG/templates"
cp "$PLUGIN/templates/map.php" "$STAGE/$PLUGIN_SLUG/templates/"
echo "  staged"

# --- no live data may be bundled ------------------------------------------
node -e '
const fs = require("fs"), path = require("path");
const dir = process.argv[1] + "/data/reference/race";
const volatile = ["polls","poll_detail","markets","market_list","money",
                  "state_funds","vitals","news","coverage","last_updated"];
const bad = [];
for (const f of fs.readdirSync(dir)) {
  const race = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const k of volatile) if (race[k] != null) bad.push(f + ": " + k);
  if (JSON.stringify(race).includes("is_mock")) bad.push(f + ": is_mock marker");
}
if (bad.length) { console.error("  live data must not be bundled:\n    " + bad.join("\n    ")); process.exit(1); }
console.log("  no live keys or mock markers bundled across " + fs.readdirSync(dir).length + " races");
' "$STAGE/$PLUGIN_SLUG/assets/$PLUGIN_SLUG" || die "the reference layer is carrying live data"

# --- no Pages-only data may be bundled -------------------------------------
# holder_party and holder_name are read by one component: the General Assembly
# hemicycle on /seats.html, which is a Pages route and not part of this plugin.
# The two exports share the payload builders, so a field added for a Pages-only
# view reaches every WordPress install unless export-reference.mjs names it --
# and nothing in the plugin's bundle references either name. This fails the
# package if one slips through, which is the only reliable signal that the list
# in that exporter is still doing its job.
node -e '
const fs = require("fs"), path = require("path");
const root = process.argv[1];
const pagesOnly = ["holder_party", "holder_name"];
const bad = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!p.endsWith(".json")) continue;
    const raw = fs.readFileSync(p, "utf8");
    for (const k of pagesOnly) if (raw.includes("\"" + k + "\"")) bad.push(path.relative(root, p) + ": " + k);
  }
};
walk(root);
if (bad.length) { console.error("  Pages-only data must not ship in the plugin:\n    " + bad.join("\n    ")); process.exit(1); }
console.log("  no Pages-only keys in the reference layer");
' "$STAGE/$PLUGIN_SLUG/assets/$PLUGIN_SLUG/data/reference" || die "the reference layer is carrying Pages-only data"

# --- versions agree --------------------------------------------------------
for v in "$PLUGIN/package.json"; do
  got="$(grep -m1 -oE '"version":[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"' "$v" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
  [ "$got" = "$VERSION" ] || die "$(basename "$v") says ${got:-nothing}, the plugin is $VERSION"
done
echo "  package.json agrees with the plugin ($VERSION)"

# --- syntax ----------------------------------------------------------------
for f in "$STAGE/$PLUGIN_SLUG/$PLUGIN_SLUG.php" "$STAGE/$PLUGIN_SLUG/templates/map.php"; do
  php -l "$f" > /dev/null || die "php syntax error in $f"
done
echo "  php syntax ok"

node --check "$STAGE/$PLUGIN_SLUG/assets/$PLUGIN_SLUG/jce-app.js" || die "jce-app.js does not parse"
echo "  js syntax ok"

# --- the mount point survives packaging -----------------------------------
# main.jsx mounts on [data-jce-root] and throws otherwise, so a rename here is a
# blank page on every install with no error anywhere. Cheap to check, invisible
# if it breaks.
grep -q 'data-jce-root' "$STAGE/$PLUGIN_SLUG/templates/map.php" \
  || die "templates/map.php lost data-jce-root; the bundle mounts on it and would throw"
echo "  mount point present"

# --- zip -------------------------------------------------------------------
mkdir -p "$DIST"
rm -f "$DIST/$ZIP_NAME"
( cd "$STAGE" && zip -qr "$DIST/$ZIP_NAME" "$PLUGIN_SLUG" )
echo "  wrote $ZIP_NAME"

# --- verify the ARTIFACT, not the source ----------------------------------
mkdir -p "$VERIFY"
( cd "$VERIFY" && unzip -q "$DIST/$ZIP_NAME" )
cp "$PLUGIN/tests/wp-stubs.php" "$VERIFY/"

shipped="$(grep -m1 ' \* Version:' "$VERIFY/$PLUGIN_SLUG/$PLUGIN_SLUG.php" | awk '{print $3}')"
[ "$shipped" = "$VERSION" ] || die "zip contains $shipped, source is $VERSION"
echo "  zip version matches source ($shipped)"

# Only the plugin's own files may ship.
allowed='\.php$|\.md$|\.css$|\.js$|\.json$|\.png$'
if unzip -Z1 "$DIST/$ZIP_NAME" | grep -v '/$' | grep -vE "$allowed"; then
  die "unexpected file type in the zip"
fi
echo "  nothing unexpected shipped"

# Everything the plugin loads at runtime has to be in the zip.
missing=0
for required in \
  carolina-election-map.php \
  templates/map.php \
  assets/carolina-election-map/jce-app.js \
  assets/carolina-election-map/jce-style.css \
  assets/carolina-election-map/data/reference/meta.json \
  assets/carolina-election-map/data/outline.json \
  assets/carolina-election-map/data/geo/us_house.json \
  assets/carolina-election-map/data/geo/us_senate.json \
  assets/carolina-election-map/data/geo/state_house.json \
  assets/carolina-election-map/data/geo/state_senate.json
do
  if [ ! -f "$VERIFY/$PLUGIN_SLUG/$required" ]; then
    echo "    missing: $required" >&2
    missing=1
  fi
done
# And every race the reference layer claims to carry.
for t in us_house us_senate state_house state_senate; do
  [ -f "$VERIFY/$PLUGIN_SLUG/assets/$PLUGIN_SLUG/data/reference/map/$t.json" ] \
    || { echo "    missing map: $t" >&2; missing=1; }
done
[ "$missing" -eq 0 ] || die "the zip is missing files the plugin loads at runtime"
echo "  all runtime files present"

# Dev tooling must not leak.
if unzip -Z1 "$DIST/$ZIP_NAME" | grep -qE 'node_modules|/tests/|package\.json|package-lock'; then
  die "dev files leaked into the zip"
fi
echo "  no dev files in the zip"

# --- render from the extracted zip ----------------------------------------
# The check that a green build cannot make. The bundle never executes here, so
# this is the only thing that proves the PHP actually produces a mount point the
# JavaScript will find, rather than an empty div.
cat > "$VERIFY/check.php" <<'PHP'
<?php
require 'wp-stubs.php';
require 'carolina-election-map/carolina-election-map.php';

$bad = 0;

// The shortcode must emit the attribute the bundle mounts on.
$h = Carolina_Election_Map::render_map(array());
if (preg_match('/data-jce-root/', $h)) {
    printf("  ok   shortcode emits data-jce-root\n");
} else {
    printf("  FAIL shortcode output has no data-jce-root; jce-app.js would throw\n");
    $bad++;
}
if (preg_match('/class="jce-root"/', $h)) {
    printf("  ok   shortcode emits the .jce-root container\n");
} else {
    printf("  FAIL shortcode output has no .jce-root container\n");
    $bad++;
}

// The attribute has to survive as a real DOM attribute, not as text.
$doc = new DOMDocument();
libxml_use_internal_errors(true);
$doc->loadHTML('<html><body>' . $h . '</body></html>');
libxml_clear_errors();
$xp = new DOMXPath($doc);
$nodes = $xp->query('//*[@data-jce-root]');
if ($nodes->length === 1) {
    printf("  ok   exactly one [data-jce-root] in the parsed DOM\n");
} else {
    printf("  FAIL parsed DOM has %d nodes matching [data-jce-root], want 1\n", $nodes->length);
    $bad++;
}

// A noscript line, so a reader without JS is told rather than shown a blank box.
if (str_contains($h, '<noscript>')) {
    printf("  ok   noscript notice kept\n");
} else {
    printf("  FAIL noscript notice missing\n");
    $bad++;
}

// Height must be escapable, not interpolated raw.
$h2 = Carolina_Election_Map::render_map(array('height' => '600px'));
if (str_contains($h2, 'min-height:600px')) {
    printf("  ok   height attribute applied\n");
} else {
    printf("  FAIL height attribute not applied\n");
    $bad++;
}
$h3 = Carolina_Election_Map::render_map(array('height' => '"><script>alert(1)</script>'));
if (!str_contains($h3, '<script>')) {
    printf("  ok   height attribute is escaped\n");
} else {
    printf("  FAIL height attribute was not escaped\n");
    $bad++;
}

// Config must resolve to something the bundle can use.
$cfg = Carolina_Election_Map::config();
foreach (array('endpoint', 'anonKey', 'cycle', 'assetBase') as $k) {
    if (empty($cfg[$k])) { printf("  FAIL config missing %s\n", $k); $bad++; }
}
if (str_ends_with($cfg['assetBase'], '/')) {
    printf("  ok   assetBase has a trailing slash (%s)\n", $cfg['assetBase']);
} else {
    printf("  FAIL assetBase has no trailing slash; paths would concatenate wrong\n");
    $bad++;
}

exit($bad === 0 ? 0 : 1);
PHP
php "$VERIFY/check.php" || die "the extracted zip does not render correctly"

echo
echo "built and verified $PLUGIN_SLUG $VERSION"
ls -lh "$DIST/$ZIP_NAME" | awk '{print "  " $5, $9}'