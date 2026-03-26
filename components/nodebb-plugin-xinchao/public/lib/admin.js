'use strict';

/*
	This file is located in the "modules" block of plugin.json
	It is only loaded when the user navigates to /admin/plugins/quickstart page
	It is not bundled into the min file that is served on the first load of the page.
*/

const settings = require('settings');
const uploader = require('uploader');

function init() {
	handleSettingsForm();
	setupUploader();
};

function handleSettingsForm() {
	settings.load('quickstart', $('.quickstart-settings'), function () {
		setupColorInputs();
	});

	$('#save').on('click', () => {
		settings.save('quickstart', $('.quickstart-settings')); // pass in a function in the 3rd parameter to override the default success/failure handler
	});
}

function setupColorInputs() {
	var colorInputs = $('[data-settings="colorpicker"]');
	colorInputs.on('change', updateColors);
	updateColors();
}

function updateColors() {
	$('#preview').css({
		color: $('#color').val(),
		'background-color': $('#bgColor').val(),
	});
}

function setupUploader() {
	$('#content input[data-action="upload"]').each(function () {
		var uploadBtn = $(this);
		uploadBtn.on('click', function () {
			uploader.show({
				route: config.relative_path + '/api/admin/upload/file',
				params: {
					folder: 'quickstart',
				},
				accept: 'image/*',
			}, function (image) {
				$('#' + uploadBtn.attr('data-target')).val(image);
			});
		});
	});
}

// Xuất hàm theo CommonJS
module.exports = {
    init,
};