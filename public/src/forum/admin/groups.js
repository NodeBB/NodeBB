$(document).ready(function() {
	var	createEl = document.getElementById('create'),
		createModal = $('#create-modal'),
		createSubmitBtn = document.getElementById('create-modal-go'),
		createNameEl = $('#create-group-name'),
		detailsModal = $('#group-details-modal'),
		listEl = $('#groups-list');

	createEl.addEventListener('click', function() {
		createModal.modal('show');
		setTimeout(function() {
			createNameEl.focus();
		}, 250);
	}, false);

	createSubmitBtn.addEventListener('click', function() {
		var	submitObj = {
				name: createNameEl.val(),
				description: $('#create-group-desc').val()
			},
			errorEl = $('#create-modal-error'),
			errorText;

		socket.emit('api:groups.create', submitObj, function(err, data) {
			if (err) {
				switch(err) {
					case 'group-exists':
						errorText = '<strong>Please choose another name</strong><p>There seems to be a group with this name already.</p>';
					break;
					case 'name-too-short':
						errorText = '<strong>Please specify a grou name</strong><p>A group name is required for administrative purposes.</p>';
					break;
					default:
						errorText = '<strong>Uh-Oh</strong><p>There was a problem creating your group. Please try again later!</p>';
					break;
				}

				errorEl.html(errorText).removeClass('hide');
			} else {
				createModal.modal('hide');
				errorEl.addClass('hide');
				createNameEl.val('');
				ajaxify.go('admin/groups');
			}
		});
	});

	listEl.on('click', 'button[data-action]', function() {
		var	action = this.getAttribute('data-action'),
			gid = $(this).parents('li[data-gid]').attr('data-gid');

		switch(action) {
			case 'delete':
				bootbox.confirm('Are you sure you wish to delete this group?', function(confirm) {
					if (confirm) {
						socket.emit('api:groups.delete', gid, function(err, data) {
							if (data === 'OK') ajaxify.go('admin/groups');
						});
					}
				});
			break;
			case 'members':
				socket.emit('api:groups.get', gid, function(err, groupObj) {
					console.log(groupObj);
					detailsModal.modal('show');
				});
			break;
		}
	});
});