'use strict';


define('iconSelect', ['benchpress', 'bootbox'], function (Benchpress, bootbox) {
	const fontawesome_license = config.fontawesome.pro ? 'pro' : 'free';
	const iconSelect = {};
	const initialIcons = [
		{ id: 'nbb-none', label: 'None (NodeBB)', style: 'nodebb' },
		{ id: 'youtube', label: 'YouTube (brands)', style: 'brands' },
		{ id: 'window-restore', label: 'Window Restore (solid)', style: 'solid' },
		{ id: 'window-maximize', label: 'Window Maximize (solid)', style: 'solid' },
		{ id: 'rectangle-xmark', label: 'Rectangle X Mark (solid)', style: 'solid' },
		{ id: 'triangle-exclamation', label: 'Triangle exclamation (solid)', style: 'solid' },
		{ id: 'phone-volume', label: 'Phone Volume (solid)', style: 'solid' },
		{ id: 'video', label: 'Video (solid)', style: 'solid' },
		{ id: 'address-card', label: 'Address Card (solid)', style: 'solid' },
		{ id: 'user', label: 'User (solid)', style: 'solid' },
		{ id: 'circle-user', label: 'Circle user (solid)', style: 'solid' },
		{ id: 'usb', label: 'USB (brands)', style: 'brands' },
		{ id: 'sort', label: 'Sort (solid)', style: 'solid' },
		{ id: 'unlock', label: 'unlock (solid)', style: 'solid' },
		{ id: 'link-slash', label: 'Link Slash (solid)', style: 'solid' },
		{ id: 'trash-can', label: 'Trash can (solid)', style: 'solid' },
		{ id: 'transgender', label: 'Transgender (solid)', style: 'solid' },
		{ id: 'mars-and-venus', label: 'Mars and Venus (solid)', style: 'solid' },
		{ id: 'square-caret-up', label: 'Square caret up (solid)', style: 'solid' },
		{ id: 'square-caret-right', label: 'Square caret right (solid)', style: 'solid' },
		{ id: 'square-caret-left', label: 'Square caret left (solid)', style: 'solid' },
		{ id: 'square-caret-down', label: 'Square caret down (solid)', style: 'solid' },
		{ id: 'circle-xmark', label: 'Circle X Mark (solid)', style: 'solid' },
		{ id: 'thumbs-up', label: 'thumbs-up (solid)', style: 'solid' },
		{ id: 'thumbs-down', label: 'thumbs-down (solid)', style: 'solid' },
		{ id: 'thumbtack', label: 'Thumbtack (solid)', style: 'solid' },
		{ id: 'temperature-full', label: 'Temperature full (solid)', style: 'solid' },
		{ id: 'temperature-three-quarters', label: 'Temperature three quarters (solid)', style: 'solid' },
		{ id: 'temperature-half', label: 'Temperature half (solid)', style: 'solid' },
		{ id: 'temperature-quarter', label: 'Temperature quarter (solid)', style: 'solid' },
		{ id: 'temperature-empty', label: 'Temperature empty (solid)', style: 'solid' },
		{ id: 'tv', label: 'Television (solid)', style: 'solid' },
		{ id: 'bars-progress', label: 'Bars progress (solid)', style: 'solid' },
		{ id: 'gauge-high', label: 'Gauge (solid)', style: 'solid' },
		{ id: 'tablet-screen-button', label: 'Tablet screen button (solid)', style: 'solid' },
		{ id: 'life-ring', label: 'Life Ring (solid)', style: 'solid' },
		{ id: 'sun', label: 'Sun (solid)', style: 'solid' },
		{ id: 'circle-stop', label: 'Circle stop (solid)', style: 'solid' },
		{ id: 'note-sticky', label: 'Note sticky (solid)', style: 'solid' },
		{ id: 'star', label: 'Star (solid)', style: 'solid' },
		{ id: 'star-half-stroke', label: 'Star half stroke (solid)', style: 'solid' },
		{ id: 'square', label: 'Square (solid)', style: 'solid' },
		{ id: 'arrow-down-9-1', label: 'Arrow down 9 1 (solid)', style: 'solid' },
		{ id: 'arrow-down-1-9', label: 'Arrow down 1 9 (solid)', style: 'solid' },
		{ id: 'sort-down', label: 'Sort Down (Descending) (solid)', style: 'solid' },
		{ id: 'sort-up', label: 'Sort Up (Ascending) (solid)', style: 'solid' },
		{ id: 'arrow-down-wide-short', label: 'Arrow down wide short (solid)', style: 'solid' },
		{ id: 'arrow-down-short-wide', label: 'Arrow down short wide (solid)', style: 'solid' },
		{ id: 'arrow-down-z-a', label: 'Arrow down z a (solid)', style: 'solid' },
		{ id: 'arrow-down-a-z', label: 'Arrow down a z (solid)', style: 'solid' },
		{ id: 'futbol', label: 'Futbol ball (solid)', style: 'solid' },
		{ id: 'snowflake', label: 'Snowflake (solid)', style: 'solid' },
		{ id: 'face-smile', label: 'Face Smile (solid)', style: 'solid' },
		{ id: 'hands', label: 'Hands (solid)', style: 'solid' },
		{ id: 'right-from-bracket', label: 'Right from bracket (solid)', style: 'solid' },
		{ id: 'right-to-bracket', label: 'Right to bracket (solid)', style: 'solid' },
		{ id: 'share-from-square', label: 'Share from square (solid)', style: 'solid' },
		{ id: 'paper-plane', label: 'Paper Plane (solid)', style: 'solid' },
		{ id: 'floppy-disk', label: 'Floppy Disk (solid)', style: 'solid' },
		{ id: 'safari', label: 'Safari (brands)', style: 'brands' },
		{ id: 'bath', label: 'Bath (solid)', style: 'solid' },
		{ id: 'arrow-rotate-right', label: 'Arrow Rotate Right (solid)', style: 'solid' },
		{ id: 'arrow-rotate-left', label: 'Arrow Rotate Left (solid)', style: 'solid' },
		{ id: 'bars', label: 'Bars (solid)', style: 'solid' },
		{ id: 'xmark', label: 'X Mark (solid)', style: 'solid' },
		{ id: 'registered', label: 'Registered Trademark (solid)', style: 'solid' },
		{ id: 'arrows-rotate', label: 'Arrows rotate (solid)', style: 'solid' },
		{ id: 'circle-question', label: 'Circle question (solid)', style: 'solid' },
		{ id: 'square-plus', label: 'Square plus (solid)', style: 'solid' },
		{ id: 'circle-play', label: 'Circle play (solid)', style: 'solid' },
		{ id: 'chart-pie', label: 'Pie Chart (solid)', style: 'solid' },
		{ id: 'image', label: 'Image (solid)', style: 'solid' },
		{ id: 'pen-to-square', label: 'Pen to square (solid)', style: 'solid' },
		{ id: 'square-pen', label: 'Square pen (solid)', style: 'solid' },
		{ id: 'circle-pause', label: 'Circle pause (solid)', style: 'solid' },
		{ id: 'opera', label: 'Opera (brands)', style: 'brands' },
		{ id: 'openid', label: 'OpenID (brands)', style: 'brands' },
		{ id: 'object-ungroup', label: 'Object Ungroup (solid)', style: 'solid' },
		{ id: 'object-group', label: 'Object Group (solid)', style: 'solid' },
		{ id: 'newspaper', label: 'Newspaper (solid)', style: 'solid' },
		{ id: 'graduation-cap', label: 'Graduation Cap (solid)', style: 'solid' },
		{ id: 'moon', label: 'Moon (solid)', style: 'solid' },
		{ id: 'money-bill-1', label: 'Money bill 1 (solid)', style: 'solid' },
		{ id: 'mobile-screen-button', label: 'Mobile screen button (solid)', style: 'solid' },
		{ id: 'square-minus', label: 'Square minus (solid)', style: 'solid' },
		{ id: 'face-meh', label: 'Face meh (solid)', style: 'solid' },
		{ id: 'map', label: 'Map (solid)', style: 'solid' },
		{ id: 'location-dot', label: 'Location dot (solid)', style: 'solid' },
		{ id: 'reply-all', label: 'reply-all (solid)', style: 'solid' },
		{ id: 'reply', label: 'Reply (solid)', style: 'solid' },
		{ id: 'share', label: 'Share (solid)', style: 'solid' },
		{ id: 'wand-magic-sparkles', label: 'Wand magic sparkles (solid)', style: 'solid' },
		{ id: 'up-long', label: 'Up long (solid)', style: 'solid' },
		{ id: 'right-long', label: 'Right long (solid)', style: 'solid' },
		{ id: 'left-long', label: 'Left long (solid)', style: 'solid' },
		{ id: 'down-long', label: 'Down long (solid)', style: 'solid' },
		{ id: 'rectangle-list', label: 'Rectangle list (solid)', style: 'solid' },
		{ id: 'chart-line', label: 'Line Chart (solid)', style: 'solid' },
		{ id: 'lightbulb', label: 'Lightbulb (solid)', style: 'solid' },
		{ id: 'turn-up', label: 'Turn up (solid)', style: 'solid' },
		{ id: 'turn-down', label: 'Turn down (solid)', style: 'solid' },
		{ id: 'lemon', label: 'Lemon (solid)', style: 'solid' },
		{ id: 'gavel', label: 'Gavel (solid)', style: 'solid' },
		{ id: 'keyboard', label: 'Keyboard (solid)', style: 'solid' },
		{ id: 'building-columns', label: 'Building with Columns (solid)', style: 'solid' },
		{ id: 'id-card', label: 'Identification Card (solid)', style: 'solid' },
		{ id: 'id-badge', label: 'Identification Badge (solid)', style: 'solid' },
		{ id: 'hourglass', label: 'Hourglass (solid)', style: 'solid' },
		{ id: 'hourglass-end', label: 'Hourglass End (solid)', style: 'solid' },
		{ id: 'hourglass-half', label: 'Hourglass Half (solid)', style: 'solid' },
		{ id: 'hourglass-start', label: 'Hourglass Start (solid)', style: 'solid' },
		{ id: 'bed', label: 'Bed (solid)', style: 'solid' },
		{ id: 'hospital', label: 'hospital (solid)', style: 'solid' },
		{ id: 'house', label: 'House (solid)', style: 'solid' },
		{ id: 'heart', label: 'Heart (solid)', style: 'solid' },
		{ id: 'heading', label: 'heading (solid)', style: 'solid' },
		{ id: 'hard-drive', label: 'Hard drive (solid)', style: 'solid' },
		{ id: 'ear-deaf', label: 'Ear deaf (solid)', style: 'solid' },
		{ id: 'handshake', label: 'Handshake (solid)', style: 'solid' },
		{ id: 'hand', label: 'Paper (Hand) (solid)', style: 'solid' },
		{ id: 'hand-spock', label: 'Spock (Hand) (solid)', style: 'solid' },
		{ id: 'hand-scissors', label: 'Scissors (Hand) (solid)', style: 'solid' },
		{ id: 'hand-back-fist', label: 'Rock (Hand) (solid)', style: 'solid' },
		{ id: 'hand-pointer', label: 'Pointer (Hand) (solid)', style: 'solid' },
		{ id: 'hand-peace', label: 'Peace (Hand) (solid)', style: 'solid' },
		{ id: 'hand-point-up', label: 'Hand Pointing Up (solid)', style: 'solid' },
		{ id: 'hand-point-right', label: 'Hand Pointing Right (solid)', style: 'solid' },
		{ id: 'hand-point-left', label: 'Hand Pointing Left (solid)', style: 'solid' },
		{ id: 'hand-point-down', label: 'Hand Pointing Down (solid)', style: 'solid' },
		{ id: 'hand-lizard', label: 'Lizard (Hand) (solid)', style: 'solid' },
		{ id: 'users', label: 'Users (solid)', style: 'solid' },
		{ id: 'gears', label: 'Gears (solid)', style: 'solid' },
		{ id: 'gear', label: 'Gear (solid)', style: 'solid' },
		{ id: 'face-frown', label: 'Face frown (solid)', style: 'solid' },
		{ id: 'font-awesome', label: 'Font Awesome (brands)', style: 'brands' },
		{ id: 'folder-open', label: 'Folder Open (solid)', style: 'solid' },
		{ id: 'folder', label: 'Folder (solid)', style: 'solid' },
		{ id: 'bolt', label: 'Bolt (solid)', style: 'solid' },
		{ id: 'flag', label: 'flag (solid)', style: 'solid' },
		{ id: 'firefox', label: 'Firefox (brands)', style: 'brands' },
		{ id: 'copy', label: 'Copy (solid)', style: 'solid' },
		{ id: 'file-zipper', label: 'File zipper (solid)', style: 'solid' },
		{ id: 'file-video', label: 'Video File (solid)', style: 'solid' },
		{ id: 'file-lines', label: 'File lines (solid)', style: 'solid' },
		{ id: 'file-audio', label: 'Audio File (solid)', style: 'solid' },
		{ id: 'file-image', label: 'Image File (solid)', style: 'solid' },
		{ id: 'file', label: 'File (solid)', style: 'solid' },
		{ id: 'file-code', label: 'Code File (solid)', style: 'solid' },
		{ id: 'eye-dropper', label: 'Eye Dropper (solid)', style: 'solid' },
		{ id: 'eye-slash', label: 'Eye Slash (solid)', style: 'solid' },
		{ id: 'eye', label: 'Eye (solid)', style: 'solid' },
		{ id: 'square-up-right', label: 'Square up right (solid)', style: 'solid' },
		{ id: 'up-right-from-square', label: 'Up right from square (solid)', style: 'solid' },
		{ id: 'up-right-and-down-left-from-center', label: 'Up right and down left from center (solid)', style: 'solid' },
		{ id: 'right-left', label: 'Right left (solid)', style: 'solid' },
		{ id: 'envelope-open', label: 'Envelope Open (solid)', style: 'solid' },
		{ id: 'envelope', label: 'Envelope (solid)', style: 'solid' },
		{ id: 'edge', label: 'Edge Browser (brands)', style: 'brands' },
		{ id: 'circle-dot', label: 'Circle dot (solid)', style: 'solid' },
		{ id: 'gem', label: 'Gem (solid)', style: 'solid' },
		{ id: 'outdent', label: 'Outdent (solid)', style: 'solid' },
		{ id: 'utensils', label: 'Utensils (solid)', style: 'solid' },
		{ id: 'scissors', label: 'Scissors (solid)', style: 'solid' },
		{ id: 'credit-card', label: 'Credit Card (solid)', style: 'solid' },
		{ id: 'creative-commons', label: 'Creative Commons (brands)', style: 'brands' },
		{ id: 'copyright', label: 'Copyright (solid)', style: 'solid' },
		{ id: 'down-left-and-up-right-to-center', label: 'Down left and up right to center (solid)', style: 'solid' },
		{ id: 'compass', label: 'Compass (solid)', style: 'solid' },
		{ id: 'comments', label: 'comments (solid)', style: 'solid' },
		{ id: 'comment-dots', label: 'Comment Dots (solid)', style: 'solid' },
		{ id: 'comment', label: 'comment (solid)', style: 'solid' },
		{ id: 'code-branch', label: 'Code Branch (solid)', style: 'solid' },
		{ id: 'cloud-arrow-up', label: 'Cloud arrow up (solid)', style: 'solid' },
		{ id: 'cloud-arrow-down', label: 'Cloud arrow down (solid)', style: 'solid' },
		{ id: 'clone', label: 'Clone (solid)', style: 'solid' },
		{ id: 'clock', label: 'Clock (solid)', style: 'solid' },
		{ id: 'paste', label: 'Paste (solid)', style: 'solid' },
		{ id: 'circle', label: 'Circle (solid)', style: 'solid' },
		{ id: 'circle-notch', label: 'Circle Notched (solid)', style: 'solid' },
		{ id: 'chrome', label: 'Chrome (brands)', style: 'brands' },
		{ id: 'square-check', label: 'Square check (solid)', style: 'solid' },
		{ id: 'circle-check', label: 'Circle check (solid)', style: 'solid' },
		{ id: 'link', label: 'Link (solid)', style: 'solid' },
		{ id: 'closed-captioning', label: 'Closed Captioning (solid)', style: 'solid' },
		{ id: 'calendar-xmark', label: 'Calendar X Mark (solid)', style: 'solid' },
		{ id: 'calendar-plus', label: 'Calendar Plus (solid)', style: 'solid' },
		{ id: 'calendar', label: 'Calendar (solid)', style: 'solid' },
		{ id: 'calendar-minus', label: 'Calendar Minus (solid)', style: 'solid' },
		{ id: 'calendar-check', label: 'Calendar Check (solid)', style: 'solid' },
		{ id: 'calendar-days', label: 'Calendar Days (solid)', style: 'solid' },
		{ id: 'taxi', label: 'Taxi (solid)', style: 'solid' },
		{ id: 'building', label: 'Building (solid)', style: 'solid' },
		{ id: 'bookmark', label: 'bookmark (solid)', style: 'solid' },
		{ id: 'bluetooth', label: 'Bluetooth (brands)', style: 'brands' },
		{ id: 'bell-slash', label: 'Bell Slash (solid)', style: 'solid' },
		{ id: 'bell', label: 'bell (solid)', style: 'solid' },
		{ id: 'battery-full', label: 'Battery Full (solid)', style: 'solid' },
		{ id: 'battery-three-quarters', label: 'Battery 3/4 Full (solid)', style: 'solid' },
		{ id: 'battery-half', label: 'Battery 1/2 Full (solid)', style: 'solid' },
		{ id: 'battery-quarter', label: 'Battery 1/4 Full (solid)', style: 'solid' },
		{ id: 'battery-empty', label: 'Battery Empty (solid)', style: 'solid' },
		{ id: 'chart-column', label: 'Chart Column (solid)', style: 'solid' },
		{ id: 'car', label: 'Car (solid)', style: 'solid' },
		{ id: 'hands-asl-interpreting', label: 'Hands american sign language interpreting (solid)', style: 'solid' },
		{ id: 'up-down', label: 'Up down (solid)', style: 'solid' },
		{ id: 'left-right', label: 'Left right (solid)', style: 'solid' },
		{ id: 'maximize', label: 'Maximize (solid)', style: 'solid' },
		{ id: 'up-down-left-right', label: 'Up down left right (solid)', style: 'solid' },
		{ id: 'circle-up', label: 'Circle up (solid)', style: 'solid' },
		{ id: 'circle-right', label: 'Circle right (solid)', style: 'solid' },
		{ id: 'circle-left', label: 'Circle left (solid)', style: 'solid' },
		{ id: 'circle-down', label: 'Circle down (solid)', style: 'solid' },
		{ id: 'chart-area', label: 'Area Chart (solid)', style: 'solid' },
		{ id: 'apple', label: 'Apple (brands)', style: 'brands' },
		{ id: 'android', label: 'Android (brands)', style: 'brands' },
		{ id: 'address-book', label: 'Address Book (solid)', style: 'solid' },
	];

	iconSelect.init = function (el, onModified) {
		onModified = onModified || function () { };
		let selected = cleanFAClass(el[0].classList);
		$('#icons .selected').removeClass('selected');
		if (selected.icon) {
			try {
				$(`#icons .nbb-fa-icons ${selected.styles.length ? '.' + selected.styles.join('.') : ''}.${selected.icon}`).addClass('selected');
			} catch (err) {
				console.error(err);
				selected = {
					icon: '',
					style: '',
				};
			}
		}

		Benchpress.render('partials/fontawesome', { icons: initialIcons }).then(function (html) {
			html = $(html);

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
							el.removeClass(selected.icon);
							for (const style of selected.styles) {
								el.removeClass(style);
							}
							el.val('');
							el.attr('value', '');
							onModified(el, '', []);
						},
					},
					success: {
						label: 'Select',
						className: 'btn-primary',
						callback: function () {
							const iconClass = $('.bootbox .selected')[0]?.classList || [`fa-${$('.bootbox #fa-filter').val()}`];
							const newIcon = cleanFAClass(iconClass);
							if (newIcon.icon) {
								el.removeClass(selected.icon).addClass(newIcon.icon);
								for (const style of selected.styles || []) {
									el.removeClass(style);
								}
								for (const style of newIcon.styles || []) {
									el.addClass(style);
								}
								// Simple workaround for lack of style information in icons by just adding the style class to the value
								const newValue = newIcon.icon + (newIcon.styles.length ? ' ' + newIcon.styles.join(' ') : '');
								el.val(newValue);
								el.attr('value', newValue);
							}

							onModified(el, newIcon.icon, newIcon.styles);
						},
					},
				},
			});

			picker.on('show.bs.modal', function () {
				const modalEl = $(this);
				const searchEl = modalEl.find('input');

				if (selected.icon) {
					modalEl.find('.' + selected.icon).addClass('selected');
					searchEl.val(selected.icon.replace('fa-', ''));
				}
			}).modal('show');

			picker.on('shown.bs.modal', function () {
				const modalEl = $(this);
				const searchEl = modalEl.find('input');
				const iconContainer = modalEl.find('.nbb-fa-icons');
				let icons = modalEl.find('.nbb-fa-icons i');
				const submitEl = modalEl.find('button.btn-primary');
				let lastSearch = '';

				function changeSelection(newSelection) {
					modalEl.find('i.selected').removeClass('selected');
					if (newSelection) {
						newSelection.addClass('selected');
					} else if (searchEl.val().length === 0) {
						if (selected.icon) {
							modalEl.find('.' + selected.icon).addClass('selected');
						}
					} else {
						modalEl.find('i:visible').first().addClass('selected');
					}
				}

				// Focus on the input box
				searchEl.selectRange(0, searchEl.val().length);

				modalEl.find('.icon-container').on('click', 'i', function () {
					searchEl.val(cleanFAClass($(this)[0].classList).icon.replace('fa-', ''));
					changeSelection($(this));
				});
				const debouncedSearch = utils.debounce(async () => {
					// Search
					let iconData;
					if (lastSearch.length) {
						iconData = await iconSelect.findIcons(lastSearch);
					} else {
						iconData = initialIcons;
					}
					icons.remove();
					iconData.forEach((iconData) => {
						iconContainer.append($(`<i class="fa fa-xl fa-${iconData.style}${iconData.family !== 'classic' ? ` fa-${iconData.family}` : ''} fa-${iconData.id} rounded-1" data-label="${iconData.label}"></i>`));
					});
					icons = modalEl.find('.nbb-fa-icons i');
					changeSelection();
				}, 200);
				searchEl.on('keyup', function (e) {
					if (e.code !== 'Enter' && searchEl.val() !== lastSearch) {
						lastSearch = searchEl.val();
						debouncedSearch();
					} else if (e.code === 'Enter') {
						submitEl.trigger('click');
					}
				});
			});
		});
	};

	const excludedClassList = [
		'nodebb',
		'fw',
		'\\d{1,2}?[xsl][smgl]',
		'rotate-(\\d+|horizontal|vertical|both|by)',
		'flip-(\\d+|horizontal|vertical|both)',
		'beat',
		'fade',
		'beat-fade',
		'bounce',
		'flip',
		'shake',
		'spin',
		'spin-pulse',
		'spin-reverse',
		'border',
		'pull-(left|right)',
		'stack(-\\dx)?',
		'inverse',
		'layers(-text)?(-counter)?',
		'ul',
		'li',
		'border',
		'swap-opacity',
		'sr-only(-focusable)?',
	];

	const excludedClassRegex = RegExp(`\\bfa-(${excludedClassList.join('|')})\\b`, 'i');

	const styleRegex = /fa-(solid|regular|brands|light|thin|duotone|sharp)/;
	// turns 'fa fa-2x fa-solid fa-heart' into 'fa-heart'
	function cleanFAClass(classList) {
		const styles = [];
		let icon;
		for (const className of classList) {
			if (className.startsWith('fa-') && !excludedClassRegex.test(className)) {
				if (styleRegex.test(className)) {
					styles.push(className);
				} else {
					icon = className;
				}
			}
		}
		return {
			icon,
			styles,
		};
	}

	iconSelect.findIcons = async function (searchString) {
		const request = await fetch('https://api.fontawesome.com', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				query: `query {
					search(version: "${config.fontawesome.version}", query: "${searchString}", first: 200) {
						id,
						label,
						familyStylesByLicense {
							${fontawesome_license} {
								style,
								family
							}
						}
					}
				}`.replace(/(\n| {2,}|\t{2,})/g, ''), // very simple minification
			}),
		});
		const response = await request.json();
		const icons = response.data.search.filter(icon => icon.familyStylesByLicense.free.length > 0).flatMap((icon) => {
			const result = [];
			icon.familyStylesByLicense[fontawesome_license].forEach((style) => {
				let familyStyle = style.style;
				if (style.family !== 'classic') {
					familyStyle = `${style.family}-${familyStyle}`;
				}
				if (!config.fontawesome.styles.includes(familyStyle)) {
					return;
				}
				result.push({
					id: icon.id,
					label: `${icon.label} (${style.style})`,
					style: style.style,
					family: style.family,
				});
			});
			return result;
		});
		return icons;
	};

	return iconSelect;
});
