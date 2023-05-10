'use strict';


define('forum/topic/tag', [
	'alerts', 'autocomplete', 'api', 'benchpress',
], function (alerts, autocomplete, api, Benchpress) {
	const Tag = {};
	let tagModal;
	let tagCommit;
	let topics;
	let tagWhitelist;
	Tag.init = function (_topics, _tagWhitelist, onComplete) {
		if (tagModal) {
			return;
		}
		topics = _topics;
		tagWhitelist = _tagWhitelist || [];

		app.parseAndTranslate('modals/tag-topic', {
			topics: topics,
			tagWhitelist: tagWhitelist,
		}, function (html) {
			tagModal = html;

			tagCommit = tagModal.find('#tag-topic-commit');

			$('body').append(tagModal);

			tagModal.find('#tag-topic-cancel').on('click', closeTagModal);

			tagCommit.on('click', async () => {
				await tagTopics();
				if (onComplete) {
					onComplete();
				}
			});

			tagModal.find('.tags').each((index, el) => {
				const tagEl = $(el);
				const tagsinputEl = tagEl.tagsinput({
					tagClass: 'badge bg-info',
					confirmKeys: [13, 44],
					trimValue: true,
				});
				const input = tagsinputEl[0].$input;

				const topic = topics[index];
				topic.tags.forEach(tag => tagEl.tagsinput('add', tag.value));

				tagEl.on('itemAdded', function (event) {
					if (tagWhitelist.length && !tagWhitelist.includes(event.item)) {
						tagEl.tagsinput('remove', event.item);
						alerts.error('[[error:tag-not-allowed]]');
					}
					if (input.length) {
						input.autocomplete('close');
					}
				});

				initAutocomplete({
					input,
					container: tagsinputEl[0].$container,
				});
			});
		});
	};

	function initAutocomplete(params) {
		autocomplete.init({
			input: params.input,
			position: { my: 'left bottom', at: 'left top', collision: 'flip' },
			appendTo: params.container,
			source: async (request, response) => {
				socket.emit('topics.autocompleteTags', {
					query: request.term,
				}, function (err, tags) {
					if (err) {
						return alerts.error(err);
					}
					if (tags) {
						response(tags);
					}
				});
			},
		});
	}

	async function tagTopics() {
		await Promise.all(tagModal.find('.tags').map(async (index, el) => {
			const topic = topics[index];
			const tagEl = $(el);
			topic.tags = await api.put(`/topics/${topic.tid}/tags`, { tags: tagEl.tagsinput('items') });
			Tag.updateTopicTags([topic]);
		}));
		closeTagModal();
	}

	Tag.updateTopicTags = function (topics) {
		topics.forEach((topic) => {
			// render "partials/category/tags" or "partials/topic/tags"
			const tpl = ajaxify.data.template.topic ? 'partials/topic/tags' : 'partials/category/tags';
			Benchpress.render(tpl, { tags: topic.tags }).then(function (html) {
				const tags = $(`[data-tid="${topic.tid}"][component="topic/tags"]`);
				tags.fadeOut(250, function () {
					tags.toggleClass('hidden', topic.tags.length === 0);
					tags.html(html).fadeIn(250);
				});
			});
		});
	};

	function closeTagModal() {
		if (tagModal) {
			tagModal.remove();
			tagModal = null;
		}
	}

	return Tag;
});
