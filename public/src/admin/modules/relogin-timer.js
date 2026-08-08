import { alert as modalsAlert } from 'modals';

let logoutTimer = 0;
let alertShown = false;
export function start(adminReloginDuration) {
	clearTimer();
	if (adminReloginDuration <= 0) {
		return;
	}

	const timeoutMs = adminReloginDuration * 60000;
	logoutTimer = setTimeout(show, timeoutMs);
}

export function show() {
	if (!alertShown) {
		modalsAlert({
			closeButton: false,
			message: '[[login:logged-out-due-to-inactivity]]',
			callback: function () {
				window.location.reload();
			},
		});
		alertShown = true;
	}
}

function clearTimer() {
	if (logoutTimer) {
		clearTimeout(logoutTimer);
	}
}