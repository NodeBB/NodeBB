import { put, del } from '../../modules/api';
import { error } from '../../modules/alerts';

import * as categorySelector from '../../modules/categorySelector';

export function init() {
	categorySelector.init($('[component="category-selector"]'), {
		onSelect: function (selectedCategory) {
			ajaxify.go('admin/manage/categories/' + selectedCategory.cid + '/federation');
		},
		showLinks: true,
		template: 'admin/partials/category/selector-dropdown-right',
	});

	$('#site-settings').on('click', '[data-action]', function () {
		const action = $(this).attr('data-action');

		switch (action) {
			case 'follow': {
				const actor = $('#syncing-add').val();

				put(`/categories/${ajaxify.data.cid}/follow`, { actor })
					.then(ajaxify.refresh)
					.catch(error);

				break;
			}

			case 'unfollow': {
				const actor = $(this).attr('data-actor');

				del(`/categories/${ajaxify.data.cid}/follow`, { actor })
					.then(ajaxify.refresh)
					.catch(error);

				break;
			}

			case 'autofill': {
				const uid = $(this).parents('[data-uid]').attr('data-uid');
				$('#syncing-add').val(uid);
			}
		}
	});
}

