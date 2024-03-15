'use strict';


define('forum/account/settings', [
	'forum/account/header', 'components', 'api', 'alerts', 'hooks',
], function (header, components, api, alerts, hooks) {
	const AccountSettings = {};
	let savedSkin = '';
	// If page skin is changed but not saved, switch the skin back
	$(window).on('action:ajaxify.start', function () {
		const skinEl = $('#bootswatchSkin');
		if (
			ajaxify.data.template.name === 'account/settings' &&
			skinEl.length && skinEl.val() !== savedSkin) {
			reskin(savedSkin);
		}
	});

	AccountSettings.init = function () {
		savedSkin = $('#bootswatchSkin').length && $('#bootswatchSkin').val();
		header.init();

		$('#submitBtn').on('click', function () {
			const settings = loadSettings();

			if (settings.homePageRoute === 'custom' && settings.homePageCustom) {
				$.get(config.relative_path + '/' + settings.homePageCustom, function () {
					saveSettings(settings);
				}).fail(function () {
					alerts.error('[[error:invalid-home-page-route]]');
				});
			} else {
				saveSettings(settings);
			}

			return false;
		});

		$('#bootswatchSkin').on('change', function () {
			reskin($(this).val());
		});

		$('[data-property="homePageRoute"]').on('change', toggleCustomRoute);

		toggleCustomRoute();

		components.get('user/sessions').find('.timeago').timeago();
	};

	function loadSettings() {
		const settings = {};

		$('.account').find('input, textarea, select').each(function (id, input) {
			input = $(input);
			const setting = input.attr('data-property');
			if (input.is('select')) {
				settings[setting] = input.val();
				return;
			}

			switch (input.attr('type')) {
				case 'checkbox':
					settings[setting] = input.is(':checked') ? 1 : 0;
					break;
				default:
					settings[setting] = input.val();
					break;
			}
		});

		return settings;
	}

	function saveSettings(settings) {
		api.put(`/users/${ajaxify.data.uid}/settings`, { settings }).then((newSettings) => {
			alerts.success('[[success:settings-saved]]');
			let languageChanged = false;
			for (const key in newSettings) {
				if (newSettings.hasOwnProperty(key)) {
					if (key === 'userLang' && config.userLang !== newSettings.userLang) {
						languageChanged = true;
					}
					if (key === 'bootswatchSkin') {
						savedSkin = newSettings.bootswatchSkin;
						config.bootswatchSkin = savedSkin === 'noskin' ? '' : savedSkin;
					} else if (config.hasOwnProperty(key)) {
						config[key] = newSettings[key];
					}
				}
			}

			if (languageChanged && parseInt(app.user.uid, 10) === parseInt(ajaxify.data.theirid, 10)) {
				window.location.reload();
			}
		});
	}

	function toggleCustomRoute() {
		if ($('[data-property="homePageRoute"]').val() === 'custom') {
			$('#homePageCustomContainer').show();
		} else {
			$('#homePageCustomContainer').hide();
			$('[data-property="homePageCustom"]').val('');
		}
	}

	function reskin(skinName) {
		const clientEl = Array.prototype.filter.call(document.querySelectorAll('link[rel="stylesheet"]'), function (el) {
			return el.href.indexOf(config.relative_path + '/assets/client') !== -1;
		})[0] || null;
		if (!clientEl) {
			return;
		}

		if (skinName === '') {
			skinName = config.defaultBootswatchSkin || '';
		} else if (skinName === 'noskin') {
			skinName = '';
		}

		const currentSkinClassName = $('body').attr('class').split(/\s+/).filter(function (className) {
			return className.startsWith('skin-');
		});
		if (!currentSkinClassName[0]) {
			return;
		}
		let currentSkin = currentSkinClassName[0].slice(5);
		currentSkin = currentSkin !== 'noskin' ? currentSkin : '';

		// Stop execution if skin didn't change
		if (skinName === currentSkin) {
			hooks.fire('action:skin.change', { skin: skinName, currentSkin });
			return;
		}
		const langDir = $('html').attr('data-dir');
		const linkEl = document.createElement('link');
		linkEl.rel = 'stylesheet';
		linkEl.type = 'text/css';
		linkEl.href = config.relative_path +
			'/assets/client' + (skinName ? '-' + skinName : '') +
			(langDir === 'rtl' ? '-rtl' : '') +
			'.css?' + config['cache-buster'];
		linkEl.onload = function () {
			clientEl.parentNode.removeChild(clientEl);

			// Update body class with proper skin name
			$('body').removeClass(currentSkinClassName.join(' '));
			$('body').addClass('skin-' + (skinName || 'noskin'));
			hooks.fire('action:skin.change', { skin: skinName, currentSkin });
		};

		document.head.appendChild(linkEl);
	}

	AccountSettings.changeSkin = async function (skin) {
		if (app.user.uid) {
			await api.put(`/users/${app.user.uid}/settings`, { settings: { bootswatchSkin: skin } });
		}
		config.bootswatchSkin = skin === 'noskin' ? '' : skin;
		savedSkin = skin;
		reskin(skin);
	};

	return AccountSettings;
});
