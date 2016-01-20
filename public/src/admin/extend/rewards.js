"use strict";
/* global define, app, ajaxify, socket, templates, bootbox */

define('admin/extend/rewards', function() {
	var rewards = {};


	var available,
		active,
		conditions,
		conditionals;

	rewards.init = function() {
		available = ajaxify.data.rewards;
		active = ajaxify.data.active;
		conditions = ajaxify.data.conditions;
		conditionals = ajaxify.data.conditionals;

		$('[data-selected]').each(function() {
			select($(this));
		});

		$('#active')
			.on('change', '[data-selected]', function() {
				update($(this));
			})
			.on('click', '.delete', function() {
				var parent = $(this).parents('[data-id]'),
					id = parent.attr('data-id');

				socket.emit('admin.rewards.delete', {id: id}, function(err) {
					if (err) {
						app.alertError(err.message);
					} else {
						app.alertSuccess('Successfully deleted reward');
					}
				});

				parent.remove();
				return false;
			})
			.on('click', '.toggle', function() {
				var btn = $(this),
					disabled = btn.hasClass('btn-success'),
					id = $(this).parents('[data-id]').attr('data-id');

				btn.toggleClass('btn-warning').toggleClass('btn-success').html(disabled ? 'Disable' : 'Enable');
				// send disable api call
				return false;
			});

		$('#new').on('click', newReward);
		$('#save').on('click', saveRewards);

		populateInputs();
	};

	function select(el) {
		el.val(el.attr('data-selected'));
		switch (el.attr('name')) {
			case 'rid':
					selectReward(el);
				break;
		}
	}

	function update(el) {
		el.attr('data-selected', el.val());
		switch (el.attr('name')) {
			case 'rid':
					selectReward(el);
				break;
		}
	}

	function selectReward(el) {
		var parent = el.parents('[data-rid]'),
			div = parent.find('.inputs'),
			inputs,
			html = '';

		for (var reward in available) {
			if (available.hasOwnProperty(reward)) {
				if (available[reward].rid === el.attr('data-selected')) {
					inputs = available[reward].inputs;
					parent.attr('data-rid', available[reward].rid);
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
	}

	function populateInputs() {
		$('[data-rid]').each(function(i) {
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
		var ul = $('#active');

		var data = {
			active: [{
				disabled: true,
				value: '',
				claimable: 1,
				rid: null,
				id: null
			}],
			conditions: conditions,
			conditionals: conditionals,
			rewards: available,
		};

		templates.parse('admin/extend/rewards', 'active', data, function(li) {
			li = $(li);
			ul.append(li);
			li.find('select').val('');
		});
	}

	function saveRewards() {
		var activeRewards = [];

		$('#active li').each(function() {
			var data = {rewards: {}},
				main = $(this).find('form.main').serializeArray(),
				rewards = $(this).find('form.rewards').serializeArray();

			main.forEach(function(obj) {
				data[obj.name] = obj.value;
			});

			rewards.forEach(function(obj) {
				data.rewards[obj.name] = obj.value;
			});

			data.id = $(this).attr('data-id');
			data.disabled = $(this).find('.toggle').hasClass('btn-success');

			activeRewards.push(data);
		});

		socket.emit('admin.rewards.save', activeRewards, function(err) {
			if (err) {
				app.alertError(err.message);
			} else {
				app.alertSuccess('Successfully saved rewards');
			}
		});
	}

	return rewards;
});
