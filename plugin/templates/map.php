<?php
/**
 * The map mount point.
 *
 * Everything the reader sees is built by jce-app.js into this element. What PHP
 * ships is the container, the inline config the bundle reads during its own
 * evaluation, and a noscript line -- so a reader without JavaScript is told the
 * map needs it rather than being shown an empty box.
 *
 * data-jce-root is the contract. main.jsx mounts on [data-jce-root] and falls
 * back to #root, which a WordPress page does not have. Rename this attribute and
 * the page renders an empty box with no error anywhere, which is exactly the
 * failure the plugin's build is checked against.
 *
 * @var array $atts  Shortcode attributes: height, cycle.
 * @var array $config Resolved Supabase config, already filtered through jce_config.
 */

defined( 'ABSPATH' ) || exit;

$jce_height = isset( $atts['height'] ) ? $atts['height'] : '760px';
$jce_cycle  = isset( $config['cycle'] ) ? $config['cycle'] : '2026';
?>
<div class="jce-root"
	data-jce-root
	data-jce
	data-cycle="<?php echo esc_attr( $jce_cycle ); ?>"
	style="min-height:<?php echo esc_attr( $jce_height ); ?>">
	<noscript>
		<p class="jce-noscript">
			The Carolina Election Map needs JavaScript. Poll averages, market prices
			and fundraising totals are read live and cannot be rendered without it.
		</p>
	</noscript>
</div>