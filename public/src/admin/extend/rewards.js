"use strict";
/* global define, app, socket, bootbox */

define('admin/extend/rewards', function() {
	var rewards = {};


	var available,
		active;

	rewards.init = function() {
		//available = JSON.parse($('#rewards').val());
		//active = JSON.parse($('#active').val());


		$(window).on('action:ajaxify.end', function() {
			$('[data-selected]').each(function() {
				console.log($(this).attr('data-selected'));
				$(this).val($(this).attr('data-selected'));
			});
		});
	};

	return rewards;
});