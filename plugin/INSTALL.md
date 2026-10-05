# Installing

## From a zip

1. **Plugins → Add New → Upload Plugin**
2. Choose `carolina-election-map.zip`
3. **Activate**
4. Put `[jce_map]` in a page, or add the **Carolina Election Map** block

## Requirements

- WordPress 6.0 or later
- PHP 7.4 or later
- Outbound HTTPS to `xbpimnerxjpwqnicwpec.supabase.co`

That last one matters: the map's live figures are read from Supabase at page load.
Behind a firewall that blocks it, the panel renders its pending notice rather than
figures. The bundled reference layer still draws the map, the districts and the
candidate list.

## Options

| Attribute | Default | |
|---|---|---|
| `height` | `760px` | Height of the map container |
| `cycle` | `2026` | Election cycle |

Block users set the height in the sidebar.

## If the page is blank

The bundle mounts on `[data-jce-root]` and throws if it is missing. If the map area
is empty, check the browser console: a `Carolina Elections: no mount point found`
error means the shortcode output did not reach the page, usually because the
plugin's assets are being served from somewhere the frontend did not expect.
Re-uploading the zip fixes a partial upload.
