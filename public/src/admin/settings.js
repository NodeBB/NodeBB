'use strict';


define('admin/settings', ['uploader', 'mousetrap', 'hooks', 'alerts'], function (uploader, mousetrap, hooks, alerts) {
	const Settings = {};

	Settings.populateTOC = function () {
		const headers = $('.settings-header');

		if (headers.length > 1) {
			headers.each(function () {
				const header = $(this).text();
				const anchor = header.toLowerCase().replace(/ /g, '-').trim();

				$(this).prepend('<a name="' + anchor + '"></a>');
				$('.section-content ul').append('<li><a href="#' + anchor + '">' + header + '</a></li>');
			});

			const scrollTo = $('a[name="' + window.location.hash.replace('#', '') + '"]');
			if (scrollTo.length) {
				$('html, body').animate({
					scrollTop: (scrollTo.offset().top) + 'px',
				}, 400);
			}
		} else {
			$('.content-header').parents('.row').remove();
		}
	};

	Settings.prepare = function (callback) {
		// Populate the fields on the page from the config
		const fields = $('#content [data-field]');
		const numFields = fields.length;
		const saveBtn = $('#save');
		const revertBtn = $('#revert');
		let x;
		let key;
		let inputType;
		let field;

		// Handle unsaved changes
		fields.on('change', function () {
			app.flags = app.flags || {};
			app.flags._unsaved = true;
		});
		const defaultInputs = ['text', 'hidden', 'password', 'textarea', 'number'];
		for (x = 0; x < numFields; x += 1) {
			field = fields.eq(x);
			key = field.attr('data-field');
			inputType = field.attr('type');
			if (app.config.hasOwnProperty(key)) {
				if (field.is('input') && inputType === 'checkbox') {
					const checked = parseInt(app.config[key], 10) === 1;
					field.prop('checked', checked);
					field.parents('.mdl-switch').toggleClass('is-checked', checked);
				} else if (field.is('textarea') || field.is('select') || (field.is('input') && defaultInputs.indexOf(inputType) !== -1)) {
					field.val(app.config[key]);
				}
			}
		}

		revertBtn.off('click').on('click', function () {
			ajaxify.refresh();
		});

		saveBtn.off('click').on('click', function (e) {
			e.preventDefault();

			saveFields(fields, function onFieldsSaved(err) {
				if (err) {
					return alerts.alert({
						alert_id: 'config_status',
						timeout: 2500,
						title: '[[admin/admin:changes-not-saved]]',
						message: `[[admin/admin:changes-not-saved-message, ${err.message}]]`,
						type: 'danger',
					});
				}

				app.flags._unsaved = false;

				alerts.alert({
					alert_id: 'config_status',
					timeout: 2500,
					title: '[[admin/admin:changes-saved]]',
					message: '[[admin/admin:changes-saved-message]]',
					type: 'success',
				});

				hooks.fire('action:admin.settingsSaved');
			});
		});

		mousetrap.bind('ctrl+s', function (ev) {
			saveBtn.click();
			ev.preventDefault();
		});

		handleUploads();
		setupTagsInput();

		$('#clear-sitemap-cache').off('click').on('click', function () {
			socket.emit('admin.settings.clearSitemapCache', function () {
				alerts.success('Sitemap Cache Cleared!');
			});
			return false;
		});

		if (typeof callback === 'function') {
			callback();
		}

		setTimeout(function () {
			hooks.fire('action:admin.settingsLoaded');
		}, 0);
	};

	function handleUploads() {
		$('#content input[data-action="upload"]').each(function () {
			const uploadBtn = $(this);
			uploadBtn.on('click', function () {
				uploader.show({
					title: uploadBtn.attr('data-title'),
					description: uploadBtn.attr('data-description'),
					route: uploadBtn.attr('data-route'),
					params: {},
					showHelp: uploadBtn.attr('data-help') ? uploadBtn.attr('data-help') === 1 : undefined,
					accept: uploadBtn.attr('data-accept'),
				}, function (image) {
					$('#' + uploadBtn.attr('data-target')).val(image);
				});
			});
		});
	}

	function setupTagsInput() {
		$('[data-field-type="tagsinput"]').tagsinput({
			confirmKeys: [13, 44],
			trimValue: true,
		});
		app.flags._unsaved = false;
	}

	Settings.remove = function (key) {
		socket.emit('admin.config.remove', key);
	};

	function saveFields(fields, callback) {
		const data = {};

		fields.each(function () {
			const field = $(this);
			const key = field.attr('data-field');
			let value;
			let inputType;

			if (field.is('input')) {
				inputType = field.attr('type');
				switch (inputType) {
					case 'text':
					case 'password':
					case 'hidden':
					case 'textarea':
					case 'number':
						value = field.val();
						break;

					case 'checkbox':
						value = field.prop('checked') ? '1' : '0';
						break;
				}
			} else if (field.is('textarea') || field.is('select')) {
				value = field.val();
			}

			data[key] = value;
		});

		socket.emit('admin.config.setMultiple', data, function (err) {
			if (err) {
				return callback(err);
			}

			for (const field in data) {
				if (data.hasOwnProperty(field)) {
					app.config[field] = data[field];
				}
			}

			callback();
		});
	}

	return Settings;
});
