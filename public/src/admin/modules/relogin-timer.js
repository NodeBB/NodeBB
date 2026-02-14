import { translate } from 'translator';
import { alert as bootboxAlert } from 'bootbox';

let logoutTimer = 0;
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
	logoutTimer = setTimeout(function () {
		bootboxAlert({
			closeButton: false,
			message: logoutMessage,
			callback: function () {
				window.location.reload();
			},
		});
	}, timeoutMs);
}

function clearTimer() {
	if (logoutTimer) {
		clearTimeout(logoutTimer);
	}
}