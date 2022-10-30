'use strict';


define('iconSelect', ['benchpress', 'bootbox'], function (Benchpress, bootbox) {
	const iconSelect = {};

	iconSelect.init = function (el, onModified) {
		onModified = onModified || function () {};
		let selected = el.attr('class').replace('fa-2x', '').replace('fa', '').replace(/\s+/g, '');

		$('#icons .selected').removeClass('selected');

		if (selected) {
			try {
				$('#icons .nbb-fa-icons .fa.' + selected).addClass('selected');
			} catch (err) {
				selected = '';
			}
		}

		Benchpress.render('partials/fontawesome', {}).then(function (html) {
			html = $(html);
			html.find('.nbb-fa-icons').prepend($('<i class="fa fa-xl fa-nbb-none"></i>'));

			const picker = bootbox.dialog({
				onEscape: true,
				backdrop: true,
				show: false,
				message: html,
				size: 'large',
				title: 'Select an Icon',
				buttons: {
					noIcon: {
						label: 'No Icon',
						className: 'btn-default',
						callback: function () {
							el.attr('class', 'fa fa-xl');
							el.val('');
							el.attr('value', '');

							onModified(el);
						},
					},
					success: {
						label: 'Select',
						className: 'btn-primary',
						callback: function () {
							const iconClass = $('.bootbox .selected').attr('class') || `fa fa-${$('.bootbox #fa-filter').val()}`;
							const categoryIconClass = $('<div></div>')
								.addClass(iconClass)
								.removeClass('fa')
								.removeClass('selected')
								.removeClass('fa-xl')
								.attr('class');
							const searchElVal = picker.find('input').val();

							if (categoryIconClass) {
								el.attr('class', 'fa fa-2x ' + categoryIconClass);
								el.val(categoryIconClass);
								el.attr('value', categoryIconClass);
							} else if (searchElVal) {
								el.attr('class', searchElVal);
								el.val(searchElVal);
								el.attr('value', searchElVal);
							}

							onModified(el);
						},
					},
				},
			});

			picker.on('show.bs.modal', function () {
				const modalEl = $(this);
				const searchEl = modalEl.find('input');

				if (selected) {
					modalEl.find('.' + selected).addClass('selected');
					searchEl.val(selected.replace(/fa-(solid|regular|brands|light|thin|duotone) /, '').replace('fa-xl', '').replace('fa-', ''));
				}
			}).modal('show');

			picker.on('shown.bs.modal', function () {
				const modalEl = $(this);
				const searchEl = modalEl.find('input');
				const iconContainer = modalEl.find('.nbb-fa-icons');
				let icons = modalEl.find('.nbb-fa-icons i');
				const submitEl = modalEl.find('button.btn-primary');

				function changeSelection(newSelection) {
					modalEl.find('i.selected').removeClass('selected');
					if (newSelection) {
						newSelection.addClass('selected');
					} else if (searchEl.val().length === 0) {
						if (selected) {
							modalEl.find('.' + selected).addClass('selected');
						}
					} else {
						modalEl.find('i:visible').first().addClass('selected');
					}
				}

				// Focus on the input box
				searchEl.selectRange(0, searchEl.val().length);

				modalEl.find('.icon-container').on('click', 'i', function () {
					searchEl.val($(this).attr('class')
						.replace(/fa-(solid|regular|brands|light|thin|duotone) /, '')
						.replace('fa fa-xl fa-', '')
						.replace('selected', ''));
					changeSelection($(this));
				});

				searchEl.on('keyup', async function (e) {
					if (e.keyCode !== 13) {
						// Filter
						const iconData = await iconSelect.findIcons(searchEl.val());
						icons.remove();
						iconData.forEach((iconData) => {
							iconContainer.append($(`<i class="fa fa-xl fa-${iconData.style} fa-${iconData.id}" data-label="${iconData.label}"></i>`));
						});
						icons = modalEl.find('.nbb-fa-icons i');
						changeSelection();
					} else {
						submitEl.click();
					}
				});
			});
		});
	};
	iconSelect.findIcons = async function (searchString) {
		const request = await fetch('https://api.fontawesome.com', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: `query {
					search(version: "6.2.0", query: "${searchString}", first: 200) {
						id,
						label,
						familyStylesByLicense {
							free {
								style
							}
						}
					}
				}`,
			}),
		});
		const response = await request.json();
		const icons = response.data.search.filter(icon => icon.familyStylesByLicense.free.length > 0).flatMap((icon) => {
			const result = [];
			icon.familyStylesByLicense.free.forEach((style) => {
				result.push({
					id: icon.id,
					label: `${icon.label} (${style.style})`,
					style: style.style,
				});
			});
			return result;
		});
		return icons;
	};

	return iconSelect;
});
