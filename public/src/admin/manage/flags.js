"use strict";
/*global define, socket, app, utils, bootbox, ajaxify*/

define('admin/manage/flags', [
	'forum/infinitescroll',
	'admin/modules/selectable',
	'autocomplete',
	'Chart'
], function(infinitescroll, selectable, autocomplete, Chart) {

	var	Flags = {};

	Flags.init = function() {
		$('.post-container .content img:not(.not-responsive)').addClass('img-responsive');

		var params = utils.params();
		$('#flag-sort-by').val(params.sortBy);
		autocomplete.user($('#byUsername'));

		handleDismiss();
		handleDismissAll();
		handleDelete();
		handleInfiniteScroll();
		handleGraphs();
	};

	function handleDismiss() {
		$('.flags').on('click', '.dismiss', function() {
			var btn = $(this);
			var pid = btn.parents('[data-pid]').attr('data-pid');

			socket.emit('posts.dismissFlag', pid, function(err) {
				done(err, btn);
			});
 		});
	}

	function handleDismissAll() {
		$('#dismissAll').on('click', function() {
			socket.emit('posts.dismissAllFlags', function(err) {
				if (err) {
					return app.alertError(err.message);
				}

				ajaxify.refresh();
			});
		});
	}

	function handleDelete() {
		$('.flags').on('click', '.delete', function() {
			var btn = $(this);
			bootbox.confirm('Do you really want to delete this post?', function(confirm) {
				if (!confirm) {
					return;
				}
				var pid = btn.parents('[data-pid]').attr('data-pid');
				var tid = btn.parents('[data-pid]').attr('data-tid');
				socket.emit('posts.delete', {pid: pid, tid: tid}, function(err) {
					done(err, btn);
				});
			});
		});
	}

	function done(err, btn) {
		if (err) {
			return app.alertError(err.messaage);
		}
		btn.parents('[data-pid]').fadeOut(function() {
			$(this).remove();
			if (!$('.flags [data-pid]').length) {
				$('.post-container').text('No flagged posts!');
			}
		});
	}

	function handleInfiniteScroll() {
		infinitescroll.init(function(direction) {
			if (direction < 0 && !$('.flags').length) {
				return;
			}
			var params = utils.params();
			var sortBy = params.sortBy || 'count';
			var byUsername = params.byUsername || '';

			infinitescroll.loadMore('posts.getMoreFlags', {
				byUsername: byUsername,
				sortBy: sortBy,
				after: $('[data-next]').attr('data-next')
			}, function(data, done) {
				if (data.posts && data.posts.length) {
					app.parseAndTranslate('admin/manage/flags', 'posts', {posts: data.posts}, function(html) {
						$('[data-next]').attr('data-next', data.next);
						$('.post-container').append(html);
						html.find('img:not(.not-responsive)').addClass('img-responsive');
						done();
					});
				} else {
					done();
				}
			});
		});
	}

	function handleGraphs() {
		var dailyCanvas = document.getElementById('flags:daily');
		var dailyLabels = utils.getDaysArray().map(function(text, idx) {
			return idx % 3 ? '' : text;
		});

		if (utils.isMobile()) {
			Chart.defaults.global.showTooltips = false;
		}
		var data = {
			'flags:daily': {
				labels: dailyLabels,
				datasets: [
					{
						label: "",
						fillColor: "rgba(151,187,205,0.2)",
						strokeColor: "rgba(151,187,205,1)",
						pointColor: "rgba(151,187,205,1)",
						pointStrokeColor: "#fff",
						pointHighlightFill: "#fff",
						pointHighlightStroke: "rgba(151,187,205,1)",
						data: ajaxify.data.analytics
					}
				]
			}
		};



		dailyCanvas.width = $(dailyCanvas).parent().width();
		new Chart(dailyCanvas.getContext('2d')).Line(data['flags:daily'], {
			responsive: true,
			animation: false
		});

	}

	return Flags;
});