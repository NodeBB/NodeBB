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
		app.parseAndTranslate('modals/crosspost-topic', {
			selectedCategory: ajaxify.data.crossposts.length ?
				{
					icon: 'fa-plus',
					name: '[[unread:multiple-categories-selected]]',
					bgColor: '#ddd',
				} :
				ajaxify.data.category,
		}, function (html) {
			modal = html;
			$('body').append(modal);

			const dropdownEl = modal.find('[component="category-selector"]');
			dropdownEl.addClass('dropup');

			categoryFilter.init($('[component="category/dropdown"]'), {
				privilege: 'moderate',
				onHidden: onCategoriesSelected,
				hideAll: true,
				hideUncategorized: true,
				localOnly: true,
				selectedCids: Array.from(new Set([ajaxify.data.cid, ...ajaxify.data.crossposts.map(c => c.cid)])),
			});

			modal.find('#crosspost_thread_commit').on('click', onCommitClicked);
			modal.find('#crosspost_topic_cancel').on('click', closeCrosspostModal);
		});
	}

	function onCategoriesSelected(data) {
		({ selectedCids } = data);
		console.log('changed? ', data.changed);
		if (data.changed) {
			modal.find('#crosspost_thread_commit').prop('disabled', false);
		}
	}

	function onCommitClicked() {
		const commitEl = modal.find('#crosspost_thread_commit');

		if (!commitEl.prop('disabled') && selectedCids && selectedCids.length) {
			commitEl.prop('disabled', true);
			const data = {
				tid: Crosspost.tid,
				cids: selectedCids,
			};

			// TODO
			// if (config.undoTimeout > 0) {
			// 	return alerts.alert({
			// 		alert_id: 'tids_move_' + (Crosspost.tid ? Crosspost.tid.join('-') : 'all'),
			// 		title: '[[topic:thread-tools.move]]',
			// 		message: message,
			// 		type: 'success',
			// 		timeout: config.undoTimeout,
			// 		timeoutfn: function () {
			// 			moveTopics(data);
			// 		},
			// 		clickfn: function (alert, params) {
			// 			delete params.timeoutfn;
			// 			alerts.success('[[topic:topic-move-undone]]');
			// 		},
			// 	});
			// }

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
			const { crossposts } = await api.get(`/topics/${data.tid}/crossposts`);
			ajaxify.data.crossposts = crossposts;
			const html = await app.parseAndTranslate('partials/topic/stats', ajaxify.data);
			statsEl.html(html);
			closeCrosspostModal();
		}).catch(alerts.error);
	}

	function closeCrosspostModal() {
		if (modal) {
			modal.remove();
			modal = null;
		}
	}

	return Crosspost;
});
