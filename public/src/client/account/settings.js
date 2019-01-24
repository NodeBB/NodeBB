'use strict';


define('forum/account/settings', ['forum/account/header', 'components', 'sounds', 'translator'], function (header, components, sounds, translator) {
	var	AccountSettings = {};

	// If page skin is changed but not saved, switch the skin back
	$(window).on('action:ajaxify.start', function () {
		if (ajaxify.data.template.name === 'account/settings' && $('#bootswatchSkin').val() !== config.bootswatchSkin) {
			app.reskin(config.bootswatchSkin);
		}
	});

	AccountSettings.init = function () {
		header.init();

		$('#submitBtn').on('click', function () {
			var settings = loadSettings();

			if (settings.homePageRoute === 'custom' && settings.homePageCustom) {
				$.get(config.relative_path + '/' + settings.homePageCustom, function () {
					saveSettings(settings);
				}).fail(function () {
					app.alertError('[[error:invalid-home-page-route]]');
				});
			} else {
				saveSettings(settings);
			}

			return false;
		});

		$('#bootswatchSkin').on('change', function () {
			app.reskin($(this).val());
		});

		$('[data-property="homePageRoute"]').on('change', toggleCustomRoute);

		$('.account').find('button[data-action="play"]').on('click', function (e) {
			e.preventDefault();

			var	soundName = $(this).parent().parent().find('select')
				.val();
			sounds.playSound(soundName);
		});

		toggleCustomRoute();

		components.get('user/sessions').find('.timeago').timeago();
	};

	function loadSettings() {
		var settings = {};

		$('.account').find('input, textarea, select').each(function (id, input) {
			input = $(input);
			var setting = input.attr('data-property');
			if (input.is('select')) {
				settings[setting] = input.val();
				return;
			}

			switch (input.attr('type')) {
			case 'text':
			case 'textarea':
				settings[setting] = input.val();
				break;
			case 'checkbox':
				settings[setting] = input.is(':checked') ? 1 : 0;
				break;
			}
		});

		return settings;
	}

	function saveSettings(settings) {
		socket.emit('user.saveSettings', { uid: ajaxify.data.theirid, settings: settings }, function (err, newSettings) {
			if (err) {
				return app.alertError(err.message);
			}

			app.alertSuccess('[[success:settings-saved]]');
			var requireReload = false;
			for (var key in newSettings) {
				if (newSettings.hasOwnProperty(key)) {
					if (key === 'userLang' && config.userLang !== newSettings.userLang) {
						requireReload = true;
					}
					if (config.hasOwnProperty(key)) {
						config[key] = newSettings[key];
					}
				}
			}

			sounds.loadMap();

			if (requireReload && parseInt(app.user.uid, 10) === parseInt(ajaxify.data.theirid, 10)) {
				translator.translate('[[language:dir]]', config.userLang, function (translated) {
					var htmlEl = $('html');
					htmlEl.attr('data-dir', translated);
					htmlEl.css('direction', translated);
				});
				ajaxify.refresh();
			}
		});
	}

	function toggleCustomRoute() {
		if ($('[data-property="homePageRoute"]').val() === 'custom') {
			$('#homePageCustom').show();
		} else {
			$('#homePageCustom').hide();
			$('[data-property="homePageCustom"]').val('');
		}
	}

	return AccountSettings;
});
