export interface NavItem {
	href: string;
	label: string;
}

export const NAV_ITEMS: NavItem[] = [
	{ href: '/', label: 'Overview' },
	{ href: '/leaderboard', label: 'Leaderboard' },
	{ href: '/explorer', label: 'Explorer' },
	{ href: '/players', label: 'Players' },
	{ href: '/run-types', label: 'Run Types' },
	{ href: '/matches', label: 'Matches' },
	{ href: '/about', label: 'About' }
];

export function isActive(pathname: string, href: string): boolean {
	if (href === '/') return pathname === '/';
	return pathname === href || pathname.startsWith(`${href}/`);
}
