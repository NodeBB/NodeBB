"use strict";
/* global define, app, socket, bootbox */

define('admin/extend/rewards', function() {
	var rewards = {};


	var available,
		active;

	rewards.init = function() {
		available = JSON.parse($('#rewards').val());
		active = JSON.parse($('#active').val());

		$('[data-selected]').each(function() {
			$(this).val($(this).attr('data-selected'));
		});
	};

	return rewards;
});