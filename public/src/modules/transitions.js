let active = false;

export function start() {
	if (active) {
		return;
	}

	active = true;

	if (!document.startViewTransition) {
		$('#footer, #content').removeClass('hide').addClass('ajaxifying');
		return;
	}

	const { ready } = document.startViewTransition();
	ready.then(() => {
		console.log('ready!');
	});
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
