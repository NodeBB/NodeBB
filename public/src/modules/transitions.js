let active = false;

export async function start(process) {
	if (active) {
		return;
	}

	active = true;

	if (!document.startViewTransition) {
		$('#footer, #content').removeClass('hide').addClass('ajaxifying');
		await process();
		return;
	}

	document.startViewTransition(process);
}

export function end() {
	if (!active) {
		return;
	}

	if (!document.startViewTransition) {
		$('#content, #footer').removeClass('ajaxifying');
	}

	active = false;
}

export function isActive() {
	return active;
}
