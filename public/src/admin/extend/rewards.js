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

			$('.delete').on('click', function() {
				var parent = $(this).parents('[data-index]'),
					id = parent.attr('data-index');

				delete active[id];
				// send delete api call

				parent.remove();
				return false;
			});

			$('.toggle').on('click', function() {
				var btn = $(this),
					disabled = btn.html() === 'Enable',
					id = $(this).parents('[data-index]').attr('data-index');

				btn.toggleClass('btn-warning').toggleClass('btn-success').html(disabled ? 'Enable' : 'Disable');
				// send disable api call
				return false;
			});

			$('#new').on('click', newReward);
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
		var parent = el.parents('[data-id]'),
			div = parent.find('.inputs'),
			inputs,
			html = '';

		for (var reward in available) {
			if (available.hasOwnProperty(reward)) {
				if (available[reward].id === el.attr('data-selected')) {
					inputs = available[reward].inputs;
					parent.attr('data-id', available[reward].id);
					break;
				}
			}
		}

		if (!inputs) {
			return app.alertError('Illegal reward - no inputs found! ' + el.attr('data-selected'));
		}

		inputs.forEach(function(input) {
			html += '<label for="' + input.name + '">' + input.label + '<br />';
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
			html += '</label><br />';
		});

		div.html(html);

		populateInputs();
	}

	function populateInputs() {
		$('[data-id]').each(function(i) {
			var div = $(this).find('.inputs'),
				rewards = active[i].rewards;

			for (var reward in rewards) {
				if (rewards.hasOwnProperty(reward)) {
					div.find('[name="' + reward + '"]').val(rewards[reward]);	
				}
			}
		});
	}

	function newReward() {
		var ul = $('#active'),
			li = $('#active li').last().clone(true);

		li.attr('data-index', parseInt(li.attr('data-index') + 1, 10))
			.attr('data-id', '');
		
		li.find('.inputs').html('');
		li.find('[name="reward"]').val('');
		li.find('.toggle').removeClass('btn-warning').addClass('btn-success').html('Enable');
		
		ul.append(li);
	}

	return rewards;
});