<?php
/**
 * Enough of WordPress to render the plugin outside WordPress.
 *
 * Not a mock of the plugin -- a mock of the handful of WordPress functions the
 * plugin calls, so the build can render the real template from the real extracted
 * zip and assert on the markup. It is deliberately thin: if the plugin starts
 * calling something not stubbed here, the build fails loudly rather than the
 * stub quietly returning null and the assertion passing on an empty string.
 *
 * Each function that would silently return something falsy in a stub instead
 * throws, so a missing stub cannot masquerade as a passing check.
 */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', '/tmp/jce-abspath/' );
}

function jce_fail_missing_stub( $fn ) {
	fwrite( STDERR, "unstubbed WordPress function: $fn()\n" );
	exit( 70 );
}

// --- escaping --------------------------------------------------------------
function esc_attr( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
function esc_html( $t ) { return htmlspecialchars( (string) $t, ENT_QUOTES, 'UTF-8' ); }
function esc_url( $u ) { return htmlspecialchars( (string) $u, ENT_QUOTES, 'UTF-8' ); }
function __( $s, $d = null ) { return $s; }
// Strips tags and control characters, then trims -- enough for the shortcode
// attributes this plugin accepts (a height and a cycle), and stricter than the
// esc_attr the template applies afterwards.
function sanitize_text_field( $t ) { return trim( strip_tags( (string) $t ) ); }
function _e( $s, $d = null ) { echo $s; }
function trailingslashit( $s ) { return rtrim( (string) $s, '/\\' ) . '/'; }

// --- enqueueing ------------------------------------------------------------
$GLOBALS['jce_enqueued'] = array( 'styles' => array(), 'scripts' => array(), 'inline' => array() );

function wp_enqueue_style( $handle, $src = '', $deps = array(), $ver = false ) {
	$GLOBALS['jce_enqueued']['styles'][] = compact( 'handle', 'src', 'ver' );
}
function wp_enqueue_script( $handle, $src = '', $deps = array(), $ver = false, $in_footer = false ) {
	$GLOBALS['jce_enqueued']['scripts'][] = compact( 'handle', 'src', 'ver', 'in_footer' );
}
function wp_register_script( $handle, $src = false, $deps = array(), $ver = false ) { return true; }
function wp_add_inline_script( $handle, $data, $position = 'after' ) {
	$GLOBALS['jce_enqueued']['inline'][] = compact( 'handle', 'data', 'position' );
}
function wp_localize_script( ...$a ) { jce_fail_missing_stub( 'wp_localize_script' ); }

// --- paths and urls --------------------------------------------------------
function plugins_url( $path = '', $plugin = '' ) {
	if ( '' !== $path ) { jce_fail_missing_stub( 'plugins_url with a path' ); }
	// A subdirectory install, which is the case most likely to be got wrong.
	return 'https://example.test/wp-content/plugins/carolina-election-map';
}
function plugin_dir_path( $file ) { return trailingslashit( dirname( (string) $file ) ); }
function plugin_basename( $file ) { return basename( (string) $file ); }

// --- hooks -----------------------------------------------------------------
$GLOBALS['jce_hooks'] = array();

function add_action( $hook, $cb, $priority = 10, $args = 1 ) {
	$GLOBALS['jce_hooks'][ $hook ][] = $cb;
}
function add_filter( $hook, $cb, $priority = 10, $args = 1 ) {
	$GLOBALS['jce_hooks'][ $hook ][] = $cb;
}
function apply_filters( $hook, $value ) {
	foreach ( $GLOBALS['jce_hooks'][ $hook ] ?? array() as $cb ) {
		$value = $cb( $value );
	}
	return $value;
}
function has_filter( $hook, $cb = false ) { return ! empty( $GLOBALS['jce_hooks'][ $hook ] ); }

// --- shortcodes ------------------------------------------------------------
$GLOBALS['jce_shortcodes'] = array();

function add_shortcode( $tag, $cb ) { $GLOBALS['jce_shortcodes'][ $tag ] = $cb; }
function shortcode_exists( $tag ) { return isset( $GLOBALS['jce_shortcodes'][ $tag ] ); }
function has_shortcode( $content, $tag ) { return false !== strpos( (string) $content, '[' . $tag ); }
function shortcode_atts( $pairs, $atts, $shortcode = '' ) {
	$atts = (array) $atts;
	$out  = array();
	foreach ( $pairs as $name => $default ) {
		$out[ $name ] = array_key_exists( $name, $atts ) ? $atts[ $name ] : $default;
	}
	return $out;
}
function do_shortcode( $content ) {
	// Only the bare form the plugin registers, which is all the smoke test uses.
	foreach ( $GLOBALS['jce_shortcodes'] as $tag => $cb ) {
		if ( preg_match_all( "/\[$tag\b([^\]]*)\]/", (string) $content, $m, PREG_SET_ORDER ) ) {
			foreach ( $m as $found ) {
				$atts = array();
				if ( preg_match_all( '/(\w+)\s*=\s*"([^"]*)"/', $found[1], $pairs, PREG_SET_ORDER ) ) {
					foreach ( $pairs as $p ) { $atts[ $p[1] ] = $p[2]; }
				}
				$content = str_replace( $found[0], (string) call_user_func( $cb, $atts ), $content );
			}
		}
	}
	return $content;
}

// --- blocks ----------------------------------------------------------------
function register_block_type( $name, $args = array() ) {
	$GLOBALS['jce_blocks'][ $name ] = $args;
	return $args;
}
function has_block( $name, $post = null ) { return false; }
function is_singular( $types = '' ) { return false; }
function get_post( $p = null ) { return null; }

// --- misc ------------------------------------------------------------------
function wp_json_encode( $data, $flags = 0, $depth = 512 ) { return json_encode( $data, $flags, $depth ); }
function add_query_arg( ...$a ) { jce_fail_missing_stub( 'add_query_arg' ); }