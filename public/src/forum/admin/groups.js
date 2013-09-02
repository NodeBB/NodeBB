$(document).ready(function() {
	var	createEl = document.getElementById('create'),
		createModal = $('#create-modal'),
		createSubmitBtn = document.getElementById('create-modal-go'),
		createNameEl = $('#create-group-name'),
		detailsModal = $('#group-details-modal'),
		detailsSearch = detailsModal.find('#group-details-search'),
		searchDelay = undefined,
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
					var	formEl = detailsModal.find('form'),
						nameEl = formEl.find('#change-group-name'),
						descEl = formEl.find('#change-group-desc'),
						membersEl = formEl.find('ul.members'),
						memberIcon = document.createElement('li'),
						numMembers = groupObj.members.length,
						membersFrag = document.createDocumentFragment(),
						memberIconImg, x;

					console.log(groupObj);

					nameEl.val(groupObj.name);
					descEl.val(groupObj.description);

					// Member list
					memberIcon.innerHTML = '<img />';
					memberIconImg = memberIcon.querySelector('img');
					if (numMembers > 0) {
						for(x=0;x<numMembers;x++) {
							memberIconImg.src = groupObj.members[x].picture;
							membersFrag.appendChild(memberIcon.cloneNode(true));
						}
						membersEl.appendChild(membersFrag);
					}

					detailsModal.modal('show');
				});
			break;
		}
	});

	detailsSearch.on('keyup', function() {
		var	searchEl = this;

		if (searchDelay) clearTimeout(searchDelay);

		searchDelay = setTimeout(function() {
			var	searchText = searchEl.value,
				resultsEl = document.getElementById('group-details-search-results'),
				foundUser = document.createElement('li'),
				foundUserImg, foundUserLabel;

			foundUser.innerHTML = '<img /><span></span>';
			foundUserImg = foundUser.getElementsByTagName('img')[0];
			foundUserLabel = foundUser.getElementsByTagName('span')[0];

			socket.emit('api:admin.user.search', searchText, function(err, results) {
				if (!err && results && results.length > 0) {
					var	numResults = results.length,
						resultsSlug = document.createDocumentFragment(),
						x;
					if (numResults > 4) numResults = 4;
					for(x=0;x<numResults;x++) {
						foundUserImg.src = results[x].picture;
						foundUserLabel.innerHTML = results[x].username;
						foundUser.setAttribute('title', results[x].username);
						resultsSlug.appendChild(foundUser.cloneNode(true));
					}

					resultsEl.innerHTML = '';
					resultsEl.appendChild(resultsSlug);
				} else resultsEl.innerHTML = '<li>No Users Found</li>';
			});
		}, 200);
	});
});