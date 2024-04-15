import { put, del } from '../../modules/api';
import { error } from '../../modules/alerts';

import * as categorySelector from '../../modules/categorySelector';

// eslint-disable-next-line import/prefer-default-export
export function init() {
	categorySelector.init($('[component="category-selector"]'), {
		onSelect: function (selectedCategory) {
			ajaxify.go('admin/manage/categories/' + selectedCategory.cid + '/federation');
		},
		showLinks: true,
		template: 'admin/partials/category/selector-dropdown-right',
	});

	document.getElementById('site-settings').addEventListener('click', async (e) => {
		const subselector = e.target.closest('[data-action]');
		if (!subselector) {
			return;
		}

		const action = subselector.getAttribute('data-action');

		switch (action) {
			case 'follow': {
				const inputEl = document.getElementById('syncing.add');
				const actor = inputEl.value;

				put(`/categories/${ajaxify.data.cid}/follow`, { actor })
					.then(ajaxify.refresh)
					.catch(error);

				break;
			}

			case 'unfollow': {
				const actor = subselector.getAttribute('data-actor');

				del(`/categories/${ajaxify.data.cid}/follow`, { actor })
					.then(ajaxify.refresh)
					.catch(error);

				break;
			}
		}
	});
}

