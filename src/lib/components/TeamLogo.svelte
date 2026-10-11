<script lang="ts">
	let {
		teamId,
		name,
		size = 24
	}: {
		teamId: number | string;
		name: string;
		size?: number;
	} = $props();

	let failed = $state(false);

	// Short fallback label if a crest is missing: initials of the club's significant words.
	const initials = $derived(
		name
			.replace(/\b(Football Club|FC|F\.C\.)\b/gi, '')
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w[0])
			.join('')
			.slice(0, 3)
			.toUpperCase()
	);
</script>

<!--
	A fixed square box with the crest scaled to fit and centred, so tall, wide and round
	crests all line up. In dark mode .crest adds a faint light outline (see layout.css) so
	crests with black lettering stay legible.
-->
<span class="inline-block shrink-0 align-middle" style="width: {size}px; height: {size}px" title={name}>
	{#if failed}
		<span
			class="grid h-full w-full place-items-center rounded-full bg-bg-sunken font-mono font-medium text-fg-soft"
			style="font-size: {Math.round(size * 0.34)}px"
		>
			{initials}
		</span>
	{:else}
		<img
			src="/api/teams/{teamId}/logo"
			alt="{name} crest"
			width={size}
			height={size}
			class="crest block h-full w-full object-contain"
			loading="lazy"
			decoding="async"
			onerror={() => (failed = true)}
		/>
	{/if}
</span>
