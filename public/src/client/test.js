import 'jquery-ui/ui/widgets/datepicker';
import Sortable from 'sortablejs';
import semver from 'semver';
import * as autocomplete from 'autocomplete';
// we are using browser colorpicker
// import { enable as colorpickerEnable } from '../admin/modules/colorpicker';
import 'jquery-deserialize';
import * as api from 'api';
import * as alerts from 'alerts';

export function init() {
	console.log('should be true semver.gt("1.1.1", "1.0.0")', semver.gt('1.1.1', '1.0.0'));
	$('#change-skin').val(config.bootswatchSkin);

	$('#inputTags').tagsinput({
		confirmKeys: [13, 44],
		trimValue: true,
	});

	$('#inputBirthday').datepicker({
		changeMonth: true,
		changeYear: true,
		yearRange: '1900:-5y',
		defaultDate: '-13y',
	});

	$('#change-language').on('click', function () {
		config.userLang = 'tr';
		var languageCode = utils.userLangToTimeagoCode(config.userLang);
		import(/* webpackChunkName: "timeago/[request]" */ 'timeago/locales/jquery.timeago.' + languageCode).then(function () {
			overrides.overrideTimeago();
			ajaxify.refresh();
		});
	});

	// colorpickerEnable($('#colorpicker'));

	autocomplete.user($('#autocomplete'));

	Sortable.create($('#sortable-list')[0], {});

	var data = $('#form-serialize').serializeObject();
	$('#json-form-data').text(JSON.stringify(data, null, 2));

	$('#form-deserialize').deserialize({
		foo: [1, 2],
		moo: 'it works',
	});

	$('#change-skin').change(async function () {
		var newSkin = $(this).val();
        api.put(`/users/${app.user.uid}/settings`, {
			settings: {
                postsPerPage: 20,
				topicsPerPage: 20,
				bootswatchSkin: newSkin,
            }
        }).then((newSettings) => {
			config.bootswatchSkin = newSkin;
			reskin(newSkin);
		}).catch(alerts.error);
	});

    // copied from account/settings
	async function reskin(skinName) {
		const clientEl = Array.prototype.filter.call(document.querySelectorAll('link[rel="stylesheet"]'), function (el) {
			return el.href.indexOf(config.relative_path + '/assets/client') !== -1;
		})[0] || null;
		if (!clientEl) {
			return;
		}

		const currentSkinClassName = $('body').attr('class').split(/\s+/).filter(function (className) {
			return className.startsWith('skin-');
		});
		if (!currentSkinClassName[0]) {
			return;
		}
		let currentSkin = currentSkinClassName[0].slice(5);
		currentSkin = currentSkin !== 'noskin' ? currentSkin : '';

		// Stop execution if skin didn't change
		if (skinName === currentSkin) {
			return;
		}

		const linkEl = document.createElement('link');
		linkEl.rel = 'stylesheet';
		linkEl.type = 'text/css';
		linkEl.href = config.relative_path + '/assets/client' + (skinName ? '-' + skinName : '') + '.css';
		linkEl.onload = function () {
			clientEl.parentNode.removeChild(clientEl);

			// Update body class with proper skin name
			$('body').removeClass(currentSkinClassName.join(' '));
			$('body').addClass('skin-' + (skinName || 'noskin'));
		};

		document.head.appendChild(linkEl);
	}
}

const testPage = { init };
export default testPage;