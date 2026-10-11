<script lang="ts">
	let {
		playerId,
		name,
		hasHeadshot,
		size = 32
	}: {
		playerId: number | string;
		name: string;
		/** Skip the request entirely when we already know there's no photo. */
		hasHeadshot: boolean;
		size?: number;
	} = $props();

	let failed = $state(false);

	const initials = $derived(
		name
			.replace(/\./g, ' ')
			.split(/\s+/)
			.filter(Boolean)
			.map((w) => w[0])
			.filter((c, i, all) => i === 0 || i === all.length - 1)
			.join('')
			.toUpperCase()
	);
</script>

<span
	class="inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-bg-sunken"
	style="width: {size}px; height: {size}px"
	title={name}
>
	{#if hasHeadshot && !failed}
		<img
			src="/api/players/{playerId}/headshot"
			alt=""
			class="h-full w-full object-cover object-top"
			loading="lazy"
			decoding="async"
			onerror={() => (failed = true)}
		/>
	{:else}
		<span class="font-mono font-medium text-fg-soft" style="font-size: {Math.round(size * 0.36)}px" aria-hidden="true">{initials}</span>
	{/if}
</span>
