export function setupFullscreen($btn, $container) {
	let fsMethod;
	let exitMethod;
	const container = $container.get(0);
	if (container.requestFullscreen) {
		fsMethod = 'requestFullscreen';
		exitMethod = 'exitFullscreen';
	} else if (container.mozRequestFullScreen) {
		fsMethod = 'mozRequestFullScreen';
		exitMethod = 'mozCancelFullScreen';
	} else if (container.webkitRequestFullscreen) {
		fsMethod = 'webkitRequestFullscreen';
		exitMethod = 'webkitCancelFullScreen';
	} else if (container.msRequestFullscreen) {
		fsMethod = 'msRequestFullscreen';
		exitMethod = 'msCancelFullScreen';
	}

	if (fsMethod) {
		$btn.on('click', function () {
			if ($container.hasClass('fullscreen')) {
				document[exitMethod]().catch(err => console.error(err));
				$container.removeClass('fullscreen');
			} else {
				container[fsMethod]().catch(err => console.error(err));
				$container.addClass('fullscreen');
			}
		});
	}
}