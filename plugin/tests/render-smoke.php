<?php
/**
 * Renders the plugin from the source tree, without a build.
 *
 * tools/build.sh is the real gate -- it runs the same assertions against the
 * extracted zip rather than the source, because a bundler never executes what it
 * emits. This is the quick version for editing the PHP.
 */

require __DIR__ . '/wp-stubs.php';
require dirname( __DIR__ ) . '/carolina-election-map.php';

$bad = 0;
$h = Carolina_Election_Map::render_map( array() );

$checks = array(
	'data-jce-root present'   => (bool) preg_match( '/data-jce-root/', $h ),
	'.jce-root container'     => (bool) preg_match( '/class="jce-root"/', $h ),
	'noscript notice'         => str_contains( $h, '<noscript>' ),
	'default height applied'  => str_contains( $h, 'min-height:760px' ),
	'cycle attribute'         => str_contains( $h, 'data-cycle="2026"' ),
);

$h2 = Carolina_Election_Map::render_map( array( 'height' => '500px' ) );
$checks['custom height']    = str_contains( $h2, 'min-height:500px' );

$h3 = Carolina_Election_Map::render_map( array( 'height' => '"><script>alert(1)</script>' ) );
$checks['height is escaped'] = ! str_contains( $h3, '<script>' );

$cfg = Carolina_Election_Map::config();
$checks['config endpoint']   = ! empty( $cfg['endpoint'] );
$checks['config anonKey']    = ! empty( $cfg['anonKey'] );
$checks['assetBase slash']   = str_ends_with( $cfg['assetBase'], '/' );
$checks['shortcode at ' . Carolina_Election_Map::SHORT_MAP ] = shortcode_exists( Carolina_Election_Map::SHORT_MAP );

foreach ( $checks as $label => $ok ) {
	printf( "  %s %s\n", $ok ? 'ok  ' : 'FAIL', $label );
	if ( ! $ok ) { $bad++; }
}

exit( $bad === 0 ? 0 : 1 );
