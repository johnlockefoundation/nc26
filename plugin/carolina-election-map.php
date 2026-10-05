<?php
/**
 * Plugin Name:       Carolina Election Map
 * Plugin URI:        https://www.johnlocke.org/
 * Description:       Embeds the Carolina Election Map — North Carolina's 2026 U.S. House, U.S. Senate, NC Senate and NC House races, with prediction-market prices, polling averages, fundraising and district demographics. Use the [jce_map] shortcode or the "Carolina Election Map" block.
 * Version:           1.0.4
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * License:           GPL-2.0-or-later
 * Text Domain:       jce
 *
 * The plugin and the GitHub Pages site at nc26/ are one frontend built twice.
 * This repository is the WordPress half: the PHP wrapper, the packaging, and the
 * checks that run against the built zip rather than against the source tree.
 * The data pipeline lives in nc26/ and is not part of this repository.
 *
 * Everything mutable is read from Supabase at page load and the bundled
 * reference layer underneath it only ever holds invariant facts — names,
 * districts, the Census profile, geometry. A price, a poll average or a
 * fundraising total is never frozen into a shipped file, because a figure
 * baked into a plugin install silently reads as live for as long as the plugin
 * is installed. See README.md.
 */

defined( 'ABSPATH' ) || exit;

final class Carolina_Election_Map {

	const VERSION = '1.0.0';
	const SLUG    = 'carolina-election-map';
	const SHORT_MAP = 'jce_map';

	/**
	 * Register the shortcode and the block. Both render the same markup through
	 * the same template, so there is one thing to keep correct.
	 */
	public static function init() {
		add_action( 'init', array( __CLASS__, 'register_block' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ) );
		add_shortcode( self::SHORT_MAP, array( __CLASS__, 'render_map' ) );
	}

	/**
	 * The directory the plugin's own files are served from, as a URL with a
	 * trailing slash.
	 *
	 * plugins_url() rather than a hand-built path, because WordPress decides
	 * where the plugins directory lives — a subdirectory install, a symlinked
	 * plugin, or a site served from a subdirectory all break the naive form.
	 *
	 * This is the one value the frontend cannot know for itself, which is why
	 * api.js reads it from window.jceConfig: it derives the same directory from
	 * document.currentScript when the config is absent, so a stale or missing
	 * assetBase degrades to a working relative guess instead of a blank page.
	 */
	public static function asset_base() {
		return trailingslashit( plugins_url( '', __FILE__ ) ) . 'assets/' . self::SLUG . '/';
	}

	/**
	 * The Supabase endpoint and anon key, handed to the bundle.
	 *
	 * Both are overridable from the admin or a mu-plugin via the jce_config
	 * filter, so a site can point at a different project without a rebuild.
	 * The anon key is a publishable identifier by design: every table has RLS
	 * enabled with SELECT-only policies for the anon role, so the most it grants
	 * is a read of rows the page already displays. Rotating it is a code change,
	 * not a leak response.
	 *
	 * @param array $config Config overrides keyed endpoint/anonKey/cycle/assetBase.
	 */
	public static function config() {
		$defaults = array(
			'endpoint'  => 'https://xbpimnerxjpwqnicwpec.supabase.co',
			'anonKey'   => 'sb_publishable_LG2eHM6wdkMQYHUGTE0Xtg_VUxP4KGp',
			'cycle'     => '2026',
			'assetBase' => self::asset_base(),
		);

		/**
		 * Filters the Supabase config handed to the frontend bundle.
		 *
		 * @param array $defaults endpoint, anonKey, cycle, assetBase.
		 */
		return apply_filters( 'jce_config', $defaults );
	}

	/**
	 * Enqueue the bundle, but only on a page that actually contains the map.
	 *
	 * The bundle is ~320 KB and the reference layer ~1.5 MB of JSON, so shipping
	 * it on every page of every site would be wasteful. A shortcode or a block
	 * in the post content is the signal that it is wanted.
	 */
	public static function enqueue_assets() {
		if ( ! self::page_needs_map() ) {
			return;
		}

		$base = self::asset_base();

		wp_enqueue_style(
			self::SLUG,
			$base . 'jce-style.css',
			array(),
			self::asset_version( $base . 'jce-style.css' )
		);

		wp_enqueue_script(
			self::SLUG,
			$base . 'jce-app.js',
			array(),
			self::asset_version( $base . 'jce-app.js' ),
			true
		);

		// The bundle reads window.jceConfig during its own evaluation, so this
		// has to print before the script tag rather than being passed as
		// wp_localize_script data, which lands after it.
		$config = self::config();
		wp_add_inline_script(
			self::SLUG,
			'window.jceConfig = ' . wp_json_encode( $config ) . ';',
			'before'
		);
	}

	/**
	 * Whether the current response contains the map.
	 *
	 * Checked against the rendered post rather than the raw post content, so a
	 * map inside a reusable block or a widget area is found too.
	 */
	private static function page_needs_map() {
		if ( ! is_singular() ) {
			return false;
		}
		$post = get_post();
		if ( ! $post || ! has_shortcode( (string) $post->post_content, self::SHORT_MAP ) ) {
			// The block form carries its own comment delimiter, so a post using
			// only the block would otherwise be missed entirely.
			return has_block( 'jce/map', $post ) || has_block( 'jce/carolina-election-map', $post );
		}
		return true;
	}

	/**
	 * Cache-bust from the file's own mtime.
	 *
	 * The version constant changes when the wrapper changes, not when the
	 * frontend does — the bundle is rebuilt from nc26 on its own cadence, so a
	 * constant bump would leave sites serving a stale map indefinitely.
	 */
	private static function asset_version( $relative_url ) {
		$path = self::plugin_dir() . 'assets/' . self::SLUG . '/' . basename( $relative_url );
		$mtime = file_exists( $path ) ? filemtime( $path ) : false;
		return $mtime ? self::VERSION . '.' . $mtime : self::VERSION;
	}

	private static function plugin_dir() {
		return trailingslashit( dirname( __FILE__ ) );
	}

	/**
	 * Render the map container.
	 *
	 * Only the mount point and the config ship from PHP. The reference layer is
	 * fetched by the bundle from the plugin's own directory at runtime, so
	 * there is one copy of the race data on disk and it is the copy in the zip.
	 *
	 * @param array $atts height, cycle.
	 */
	public static function render_map( $atts ) {
		$atts = shortcode_atts(
			array(
				'height' => '760px',
				'cycle'  => '2026',
			),
			$atts,
			self::SHORT_MAP
		);

		$config = self::config();
		if ( ! empty( $atts['cycle'] ) ) {
			$config['cycle'] = sanitize_text_field( $atts['cycle'] );
		}

		ob_start();
		include self::plugin_dir() . 'templates/map.php';
		return (string) ob_get_clean();
	}

	/**
	 * Register the block. Server-rendered so the container is present without
	 * JavaScript, matching the shortcode exactly.
	 */
	public static function register_block() {
		if ( ! function_exists( 'register_block_type' ) ) {
			return;
		}

		wp_register_script(
			'jce-block',
			false,
			array(),
			self::VERSION
		);

		register_block_type(
			'jce/map',
			array(
				'api_version'     => 2,
				'title'           => __( 'Carolina Election Map', 'jce' ),
				'category'        => 'embed',
				'icon'            => 'location-alt',
				'description'     => __( 'North Carolina\'s 2026 U.S. House, U.S. Senate, NC Senate and NC House races.', 'jce' ),
				'attributes'      => array(
					'height' => array(
						'type'    => 'string',
						'default' => '760px',
					),
				),
				'render_callback' => function ( $attributes ) {
					return self::render_map(
						array( 'height' => isset( $attributes['height'] ) ? $attributes['height'] : '760px' )
					);
				},
				'editor_script'   => 'jce-block',
			)
		);
	}
}

Carolina_Election_Map::init();

/**
 * Expose the container class for tests and for the mu-plugin loader.
 */
class_exists( 'Carolina_Election_Map' );