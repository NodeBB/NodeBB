'use strict';


define('admin/settings', ['uploader'], function (uploader) {
	var Settings = {};

	Settings.init = function () {
		console.warn('[deprecation] require(\'admin/settings\').init() has been deprecated, please call require(\'admin/settings\').prepare() directly instead.');
		Settings.prepare();
	};

	Settings.populateTOC = function () {
		$('.settings-header').each(function () {
			var header = $(this).text();
			var anchor = header.toLowerCase().replace(/ /g, '-').trim();

			$(this).prepend('<a name="' + anchor + '"></a>');
			$('.section-content ul').append('<li><a href="#' + anchor + '">' + header + '</a></li>');
		});

		var scrollTo = $('a[name="' + window.location.hash.replace('#', '') + '"]');
		if (scrollTo.length) {
			$('html, body').animate({
				scrollTop: (scrollTo.offset().top) + 'px',
			}, 400);
		}
	};

	Settings.prepare = function (callback) {
		// Populate the fields on the page from the config
		var fields = $('#content [data-field]');
		var	numFields = fields.length;
		var	saveBtn = $('#save');
		var	revertBtn = $('#revert');
		var	x;
		var key;
		var inputType;
		var field;

		// Handle unsaved changes
		$(fields).on('change', function () {
			app.flags = app.flags || {};
			app.flags._unsaved = true;
		});

		for (x = 0; x < numFields; x += 1) {
			field = fields.eq(x);
			key = field.attr('data-field');
			inputType = field.attr('type');
			if (field.is('input')) {
				if (app.config[key]) {
					switch (inputType) {
					case 'text':
					case 'hidden':
					case 'password':
					case 'textarea':
					case 'number':
						field.val(app.config[key]);
						break;

					case 'checkbox':
						var checked = parseInt(app.config[key], 10) === 1;
						field.prop('checked', checked);
						field.parents('.mdl-switch').toggleClass('is-checked', checked);
						break;
					}
				}
			} else if (field.is('textarea')) {
				if (app.config.hasOwnProperty(key)) {
					field.val(app.config[key]);
				}
			} else if (field.is('select')) {
				if (app.config.hasOwnProperty(key)) {
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
					return app.alert({
						alert_id: 'config_status',
						timeout: 2500,
						title: 'Changes Not Saved',
						message: 'NodeBB encountered a problem saving your changes. (' + err.message + ')',
						type: 'danger',
					});
				}

				app.flags._unsaved = false;

				app.alert({
					alert_id: 'config_status',
					timeout: 2500,
					title: 'Changes Saved',
					message: 'Your changes to the NodeBB configuration have been saved.',
					type: 'success',
				});

				$(window).trigger('action:admin.settingsSaved');
			});
		});

		handleUploads();
		setupTagsInput();

		$('#clear-sitemap-cache').off('click').on('click', function () {
			socket.emit('admin.settings.clearSitemapCache', function () {
				app.alertSuccess('Sitemap Cache Cleared!');
			});
			return false;
		});

		if (typeof callback === 'function') {
			callback();
		}

		setTimeout(function () {
			$(window).trigger('action:admin.settingsLoaded');
		}, 0);
	};

	function handleUploads() {
		$('#content input[data-action="upload"]').each(function () {
			var uploadBtn = $(this);
			uploadBtn.on('click', function () {
				uploader.show({
					title: uploadBtn.attr('data-title'),
					description: uploadBtn.attr('data-description'),
					route: uploadBtn.attr('data-route'),
					params: {},
					showHelp: uploadBtn.attr('data-help') ? uploadBtn.attr('data-help') === 1 : undefined,
					accept: uploadBtn.attr('data-accept'),
				}, function (image) {
					// need to move these into template, ex data-callback
					if (ajaxify.currentPage === 'admin/general/sounds') {
						ajaxify.refresh();
					} else {
						$('#' + uploadBtn.attr('data-target')).val(image);
					}
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
		var data = {};

		fields.each(function () {
			var field = $(this);
			var key = field.attr('data-field');
			var value;
			var inputType;

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

			for (var field in data) {
				if (data.hasOwnProperty(field)) {
					app.config[field] = data[field];
				}
			}

			callback();
		});
	}

	return Settings;
});
