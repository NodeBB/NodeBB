import { alert as modalsAlert } from 'modals';
import { translate } from 'translator';

let logoutTimer = 0;
let alertShown = false;
let logoutMessage;
export function start(adminReloginDuration) {
	clearTimer();
	if (adminReloginDuration <= 0) {
		return;
	}

	// pre-translate language string gh#9046
	if (!logoutMessage) {
		translate('[[login:logged-out-due-to-inactivity]]', function (translated) {
			logoutMessage = translated;
		});
	}

	const timeoutMs = adminReloginDuration * 60000;
	logoutTimer = setTimeout(show, timeoutMs);
}

export function show() {
	if (!alertShown) {
		modalsAlert({
			closeButton: false,
			message: logoutMessage,
			callback: function () {
				window.location.href = config.relative_path + '/login';
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