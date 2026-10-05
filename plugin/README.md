# Carolina Election Map — WordPress plugin

Embeds the [Carolina Election Map](https://johnlockefoundation.github.io/nc26/) in
WordPress: North Carolina's 2026 U.S. House, U.S. Senate, NC Senate and NC House
races, with prediction-market prices, poll averages, fundraising totals and
district demographics.

## Install

Upload `carolina-election-map.zip` through **Plugins → Add New → Upload Plugin**,
or unzip it into `wp-content/plugins/`. Then put `[jce_map]` in a page, or add the
**Carolina Election Map** block.

```
[jce_map]
[jce_map height="900px"]
```

## What is in this repository, and what is not

This is the WordPress half. The plugin and the GitHub Pages site are one frontend
built twice.

| | This repository | [nc26](../nc26) |
|---|---|---|
| PHP wrapper, shortcode, block | yes | no |
| `tools/build.sh`, packaging checks | yes | no |
| React frontend and its styles | no — built from there | yes |
| Race data, candidates, geometry | no — built from there | yes |
| Data pipeline | no | yes |

The two halves live in one repository, `plugin/` beside `frontend/`, rather than
as two checkouts the way `property-tax-demo` → `property-tax-bill` splits them.
The reason the split is usually worth making is that the WordPress half has its
own release cadence and its own consumers; here the plugin's whole payload is the
frontend's output, so co-locating them removes a clone, a path and a version skew
between them. `NC26_DIR` still points the build at a separate checkout for anyone
who wants one.

## Building

From the repository root:

```bash
bash plugin/tools/build.sh
```

The zip is written to the repository's top-level `dist/`.

Or point at a frontend elsewhere with
`NC26_DIR=/path/to/nc26 bash plugin/tools/build.sh`.

The build runs the ingest and the plugin-target frontend build itself, because
`backend/db/` and `frontend/public/data/` are gitignored and a clean checkout has
neither.

### What the build checks

`tools/build.sh` verifies the **extracted zip**, not the source tree. A bundler
never executes the code it emits, so "the build was green" only ever meant the
artifact was well-formed — and this project shipped a blank page through three
green checks before that distinction was made to bite. So the checks run against
what actually ships:

- no volatile key and no `is_mock` marker anywhere in the bundled reference layer
- `php -l` on every PHP file, `node --check` on the bundle
- the plugin version agrees between the header and `package.json`, and the version
  in the zip matches the source
- only `.php .md .css .js .json .png` ship, and no dev files leak
- every file the frontend requests at runtime is present
- the shortcode renders from the extracted zip and the output carries exactly one
  `[data-jce-root]` **in the parsed DOM**

That last one is the check a green build cannot make. `main.jsx` in nc26 mounts on
`[data-jce-root]` and throws otherwise; renaming the attribute in the template
would render an empty div on every install with no error anywhere.

`php tests/render-smoke.php` is the same assertions against the source tree, for
when you are editing the PHP and do not need a full build.

## Configuration

Defaults live in `Carolina_Election_Map::config()` and cover the Supabase endpoint,
the anon key, the cycle and the asset base. Override them with the `jce_config`
filter, from a theme's `functions.php` or a must-use plugin:

```php
add_filter( 'jce_config', function ( $c ) {
    $c['endpoint'] = 'https://your-project.supabase.co';
    return $c;
} );
```

### On the anon key

It is committed on purpose and it is not a credential. It identifies the project,
it is meant to ship in client bundles, and it grants nothing on its own: every
table has RLS enabled with SELECT-only policies for the `anon` role, so the most
anyone can do with it is read rows the page already displays. Rotating it is a
code change, not a leak response.

## Why the bundled data is only the invariant part

The zip carries names, districts, the Census demographic profile and geometry.
It deliberately does **not** carry poll averages, market prices, fundraising
totals, registration or ballot-request figures, or news — all of those are read
from Supabase at page load.

A figure baked into a plugin install reads as live for as long as the plugin is
installed, with no timestamp on it to say otherwise. This project shipped
fabricated registration and ballot counts on sixty seats that way before the
split was made. `tools/build.sh` fails the build if any of those keys reappears in
a bundled file, so the mistake cannot be repeated quietly.

## License

GPL-2.0-or-later, matching the plugin header.
