<!--
	Decorative backdrop behind the content area, after skillcorner.com: a green glow from
	the left edge, a fainter one top-right, and SkillCorner's large "S" graphic anchored
	right and cropped by the viewport (path from the site's S-graphic.svg). Purely
	decorative (aria-hidden, no pointer events). Every colour is a --decor-* token in
	layout.css, so light and dark mode each get their own strength. It's fixed to the
	viewport and sits behind the cards, which keep their solid surfaces.
-->
<div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden md:left-60" aria-hidden="true">
	<svg class="h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="decor-glow-left" cx="-60" cy="620" r="1050" gradientUnits="userSpaceOnUse">
				<stop offset="0" style="stop-color: var(--decor-glow)" />
				<stop offset="1" style="stop-color: transparent" />
			</radialGradient>
			<radialGradient id="decor-glow-top" cx="1600" cy="0" r="620" gradientUnits="userSpaceOnUse">
				<stop offset="0" style="stop-color: var(--decor-glow-2)" />
				<stop offset="1" style="stop-color: transparent" />
			</radialGradient>
		</defs>

		<rect width="1600" height="1000" fill="url(#decor-glow-left)" />
		<rect width="1600" height="1000" fill="url(#decor-glow-top)" />

		<!-- SkillCorner "S" (922 × 1024), scaled up and pushed past the right edge. -->
		<g transform="translate(960 -110) scale(1.16)">
			<path
				style="fill: var(--decor-s)"
				d="M0.389648 1023.59L0.389648 816.955H747.139L460.89 533.804L337.573 655.795L34.5856 356.102C19.3736 340.992 10.3602 319.451 10.3602 298.427L9.99289 241.632C9.98772 84.054 110.791 0.258301 294.276 0.258301L921.39 0.258301V206.926L172.679 206.926L460.89 492.052L584.206 370.03L887.2 669.749C902.348 684.735 911.456 706.276 911.456 727.424V782.218C911.456 939.801 814.635 1023.6 629.133 1023.6L0.389648 1023.59Z"
			/>
		</g>
	</svg>
</div>
