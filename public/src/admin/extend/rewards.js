'use strict';


define('admin/extend/rewards', ['translator', 'benchpress'], function (translator, Benchpress) {
	var rewards = {};


	var available;
	var active;
	var conditions;
	var conditionals;

	rewards.init = function () {
		available = ajaxify.data.rewards;
		active = ajaxify.data.active;
		conditions = ajaxify.data.conditions;
		conditionals = ajaxify.data.conditionals;

		$('[data-selected]').each(function () {
			select($(this));
		});

		$('#active')
			.on('change', '[data-selected]', function () {
				update($(this));
			})
			.on('click', '.delete', function () {
				var parent = $(this).parents('[data-id]');
				var id = parent.attr('data-id');

				socket.emit('admin.rewards.delete', { id: id }, function (err) {
					if (err) {
						app.alertError(err.message);
					} else {
						app.alertSuccess('[[admin/extend/rewards:alert.delete-success]]');
					}
				});

				parent.remove();
				return false;
			})
			.on('click', '.toggle', function () {
				var btn = $(this);
				var disabled = btn.hasClass('btn-success');
				btn.toggleClass('btn-warning').toggleClass('btn-success').translateHtml('[[admin/extend/rewards:' + (disabled ? 'disable' : 'enable') + ']]');
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
		var parent = el.parents('[data-rid]');
		var div = parent.find('.inputs');
		var inputs;
		var html = '';

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
			return app.alertError('[[admin/extend/rewards:alert.no-inputs-found]] ' + el.attr('data-selected'));
		}

		inputs.forEach(function (input) {
			html += '<label for="' + input.name + '">' + input.label + '<br />';
			switch (input.type) {
			case 'select':
				html += '<select name="' + input.name + '">';
				input.values.forEach(function (value) {
					html += '<option value="' + value.value + '">' + value.name + '</option>';
				});
				break;
			case 'text':
				html += '<input type="text" name="' + input.name + '" />';
				break;
			}
			html += '</label><br />';
		});

		div.html(html);
	}

	function populateInputs() {
		$('[data-rid]').each(function (i) {
			var div = $(this).find('.inputs');
			var rewards = active[i].rewards;

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
				id: null,
			}],
			conditions: conditions,
			conditionals: conditionals,
			rewards: available,
		};

		Benchpress.parse('admin/extend/rewards', 'active', data, function (li) {
			translator.translate(li, function (li) {
				li = $(li);
				ul.append(li);
				li.find('select').val('');
			});
		});
	}

	function saveRewards() {
		var activeRewards = [];

		$('#active li').each(function () {
			var data = { rewards: {} };
			var main = $(this).find('form.main').serializeArray();
			var rewards = $(this).find('form.rewards').serializeArray();

			main.forEach(function (obj) {
				data[obj.name] = obj.value;
			});

			rewards.forEach(function (obj) {
				data.rewards[obj.name] = obj.value;
			});

			data.id = $(this).attr('data-id');
			data.disabled = $(this).find('.toggle').hasClass('btn-success');

			activeRewards.push(data);
		});

		socket.emit('admin.rewards.save', activeRewards, function (err) {
			if (err) {
				app.alertError(err.message);
			} else {
				app.alertSuccess('[[admin/extend/rewards:alert.save-success]]');
			}
		});
	}

	return rewards;
});
