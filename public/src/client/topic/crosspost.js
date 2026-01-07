'use strict';


define('forum/topic/crosspost', [
	'categoryFilter', 'alerts', 'hooks', 'api', 'components',
], function (categoryFilter, alerts, hooks, api, components) {
	const Crosspost = {};
	let modal;
	let selectedCids;

	Crosspost.init = function (tid) {
		if (modal) {
			return;
		}
		Crosspost.tid = tid;
		Crosspost.cid = ajaxify.data.cid;
		Crosspost.current = ajaxify.data.crossposts;

		showModal();
	};

	function showModal() {
		const selectedCategory = (() => {
			const multiple = {
				icon: 'fa-plus',
				name: '[[unread:multiple-categories-selected]]',
				bgColor: '#ddd',
			};
			if (ajaxify.data.cid > 0) {
				return ajaxify.data.crossposts.length ? multiple : ajaxify.data.category;
			}

			switch (ajaxify.data.crossposts.length) {
				case 0:
					return undefined;

				case 1:
					return ajaxify.data.crossposts[0].category;

				default:
					return multiple;
			}
		})();
		app.parseAndTranslate('modals/crosspost-topic', { selectedCategory }, function (html) {
			modal = html;
			$('body').append(modal);

			const dropdownEl = modal.find('[component="category-selector"]');
			dropdownEl.addClass('dropup');

			const selectedCids = [...ajaxify.data.crossposts.map(c => c.cid)];
			if (ajaxify.data.cid > 0) {
				selectedCids.unshift(ajaxify.data.cid);
			}
			categoryFilter.init($('[component="category/dropdown"]'), {
				onHidden: onCategoriesSelected,
				hideAll: true,
				hideUncategorized: true,
				localOnly: true,
				selectedCids: Array.from(new Set(selectedCids)),
			});

			modal.find('#crosspost_thread_commit').on('click', onCommitClicked);
			modal.find('#crosspost_topic_cancel').on('click', closeCrosspostModal);
		});
	}

	function onCategoriesSelected(data) {
		selectedCids = data.selectedCids.filter(cid => utils.isNumber(cid) && cid > 0);
		if (data.changed) {
			modal.find('#crosspost_thread_commit').prop('disabled', false);
		}
	}

	function onCommitClicked() {
		const commitEl = modal.find('#crosspost_thread_commit');

		if (!commitEl.prop('disabled')) {
			commitEl.prop('disabled', true);
			const data = {
				tid: Crosspost.tid,
				cids: selectedCids,
			};

			crosspost(data);
		}
	}

	function crosspost(data) {
		hooks.fire('action:topic.crosspost', data);

		const cids = data.cids.map((cid) => parseInt(cid, 10));
		if (!cids.includes(Crosspost.cid)) {
			cids.unshift(Crosspost.cid);
		}
		const current = [Crosspost.cid, ...Crosspost.current.map(x => parseInt(x.cid, 10))];
		const add = cids.filter(cid => !current.includes(cid));
		const remove = current.filter(cid => !cids.includes(cid));

		const queries = [
			...add.map((cid) => { return api.post(`/topics/${data.tid}/crossposts`, { cid }); }),
			...remove.map((cid) => { return api.del(`/topics/${data.tid}/crossposts`, { cid }); }),
		];

		Promise.all(queries).then(async () => {
			const statsEl = components.get('topic/stats');
			updateSpinner('progress');
			const { crossposts } = await api.get(`/topics/${data.tid}/crossposts`);
			ajaxify.data.crossposts = crossposts;
			const html = await app.parseAndTranslate('partials/topic/stats', ajaxify.data);
			statsEl.html(html);
			updateSpinner('success');
		}).catch((e) => {
			updateSpinner('error');
			alerts.error(e);
		});
	}

	const spinnerClasses = new Map(Object.entries({
		'initial': ['d-none'],
		'progress': ['fa-spinner', 'text-secondary', 'fa-spin'],
		'error': ['fa-times', 'text-error'],
		'success': ['fa-check', 'text-success'],
	}));
	function updateSpinner(state) {
		if (modal) {
			const spinnerEl = document.getElementById('crosspost_topic_spinner');
			const remove = [
				...spinnerClasses.get('initial'),
				...spinnerClasses.get('progress'),
				...spinnerClasses.get('error'),
				...spinnerClasses.get('success'),
			];
			spinnerEl.classList.remove(...remove);
			spinnerEl.classList.add(...spinnerClasses.get(state));

			if (state !== 'initial') {
				setTimeout(() => {
					updateSpinner('initial');
				}, 2500);
			}
		}
	}

	function closeCrosspostModal() {
		if (modal) {
			modal.remove();
			modal = null;
		}
	}

	return Crosspost;
});
