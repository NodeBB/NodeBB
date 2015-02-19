"use strict";
/* global define, app, ajaxify, socket, templates, bootbox */

define('admin/extend/rewards', function() {
	var rewards = {};


	var available,
		active;

	rewards.init = function() {
		$(window).on('action:ajaxify.end', function() {
			available = JSON.parse(ajaxify.variables.get('rewards'));
			active = JSON.parse(ajaxify.variables.get('active'));

			$('[data-selected]').each(function() {
				select($(this));
			}).on('change', function() {
				update($(this));
			});
		});
	};

	function select(el) {
		el.val(el.attr('data-selected'));
		switch (el.attr('name')) {
			case 'reward':
					selectReward(el);
				break;
		}
	}

	function update(el) {
		el.attr('data-selected', el.val());
		switch (el.attr('name')) {
			case 'reward':
					selectReward(el);
				break;
		}
	}

	function selectReward(el) {
		var div = el.parent().find('.inputs'),
			inputs,
			html = '';

		for (var reward in available) {
			if (available.hasOwnProperty(reward)) {
				if (parseInt(available[reward].rewardID, 10) === parseInt(el.attr('data-selected'), 10)) {
					inputs = available[reward].inputs;
					break;
				}
			}
		}

		if (!inputs) {
			app.alertError('Illegal reward - no inputs found! ' + el.attr('data-selected'));
		}

		inputs.forEach(function(input) {
			html += '<label for="' + input.name + '">' + input.label;
			switch (input.type) {
				case 'select': 
						html += '<select name="' + input.name + '">';
						input.values.forEach(function(value) {
							html += '<option value="' + value.value + '">' + value.name + '</option>';
						});
					break;
				case 'text':
						html += '<input type="text" name="' + input.name +'" />';
					break;
			}
			html += '</label>';
		});

		div.html(html);
	}

	return rewards;
});