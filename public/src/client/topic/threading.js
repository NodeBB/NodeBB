'use strict';

define('forum/topic/threading', [
	'components',
	'hooks',
	'api',
	'bootbox',
	'alerts',
], function (components, hooks, api, bootbox, alerts) {
	const Threading = {};
	
	let currentViewMode = 'flat'; // 'flat' or 'threaded'
	let postsData = [];
	
	Threading.init = function () {
		// Add threading toggle button to topic tools
		addThreadingToggle();
		
		// Listen for view mode changes
		$(document).on('click', '[data-action="toggle-threading"]', function () {
			toggleThreadingMode();
		});
		
		// Listen for reply-to-post clicks
		$(document).on('click', '[data-action="reply-to-post"]', function () {
			const pid = $(this).closest('[data-pid]').attr('data-pid');
			handleReplyToPost(pid);
		});
		
		// Listen for thread collapse/expand
		$(document).on('click', '[data-action="toggle-thread"]', function () {
			const $thread = $(this).closest('.threaded-post');
			toggleThread($thread);
		});
	};
	
	function addThreadingToggle() {
		const $topicTools = $('[component="topic/toolbar"]');
		if (!$topicTools.length) return;
		
		const toggleButton = `
			<button class="btn btn-sm btn-outline-secondary" data-action="toggle-threading" title="Toggle threaded view">
				<i class="fa fa-sitemap"></i>
				<span class="d-none d-md-inline"> Threaded</span>
			</button>
		`;
		
		$topicTools.find('.float-end').prepend(toggleButton);
	}
	
	function toggleThreadingMode() {
		const newMode = currentViewMode === 'flat' ? 'threaded' : 'flat';
		
		if (newMode === 'threaded') {
			loadThreadedView();
		} else {
			loadFlatView(); 
		}
	}
	
	async function loadThreadedView() {
		try {
			const tid = ajaxify.data.tid;
			const result = await api.get(`/topics/${tid}/posts`, { tree: 'true', flat: 'false' });
			
			if (result && result.posts) {
				currentViewMode = 'threaded';
				renderThreadedPosts(result.posts);
				updateToggleButton();
			}
		} catch (err) {
			alerts.error('[[error:could-not-load-threaded-view]]');
		}
	}
	
	async function loadFlatView() {
		try {
			const tid = ajaxify.data.tid;
			const result = await api.get(`/topics/${tid}/posts`, { tree: 'false', flat: 'true' });
			
			if (result && result.posts) {
				currentViewMode = 'flat';
				renderFlatPosts(result.posts);
				updateToggleButton();
			}
		} catch (err) {
			alerts.error('[[error:could-not-load-flat-view]]');
		}
	}
	
	function renderThreadedPosts(posts, $container = null, depth = 0) {
		if (!$container) {
			$container = $('[component="topic"]');
			$container.empty();
		}
		
		const maxDepth = 5; // Configurable max depth
		
		posts.forEach(function (post) {
			const $postEl = renderPost(post, depth);
			$container.append($postEl);
			
			// Render children recursively
			if (post.children && post.children.length > 0 && depth < maxDepth) {
				const $childContainer = $('<div class="threaded-children" data-depth="' + (depth + 1) + '"></div>');
				$postEl.append($childContainer);
				renderThreadedPosts(post.children, $childContainer, depth + 1);
			}
		});
	}
	
	function renderFlatPosts(posts) {
		const $container = $('[component="topic"]');
		$container.empty();
		
		posts.forEach(function (post) {
			const $postEl = renderPost(post, 0);
			$container.append($postEl);
		});
	}
	
	function renderPost(post, depth) {
		const indentClass = depth > 0 ? `threaded-post depth-${Math.min(depth, 5)}` : '';
		const collapseButton = post.children && post.children.length > 0 ? 
			'<button class="btn btn-sm btn-link thread-toggle" data-action="toggle-thread"><i class="fa fa-minus"></i></button>' : '';
		
		// Use existing post rendering logic but add threading classes
		const $post = $(`
			<div component="post" class="posts-container ${indentClass}" data-pid="${post.pid}" data-uid="${post.uid}" data-index="${post.index}" data-depth="${depth}">
				<div class="post-container">
					${collapseButton}
					<div class="post-content">
						<!-- Post content will be populated by existing rendering logic -->
					</div>
				</div>
			</div>
		`);
		
		// Let existing post rendering handle the details
		hooks.fire('action:post.render', { post: post, element: $post });
		
		return $post;
	}
	
	function updateToggleButton() {
		const $button = $('[data-action="toggle-threading"]');
		const $icon = $button.find('i');
		const $text = $button.find('span');
		
		if (currentViewMode === 'threaded') {
			$icon.removeClass('fa-sitemap').addClass('fa-list');
			$text.text(' Flat');
			$button.addClass('active');
		} else {
			$icon.removeClass('fa-list').addClass('fa-sitemap');
			$text.text(' Threaded');
			$button.removeClass('active');
		}
	}
	
	function handleReplyToPost(parentPid) {
		// Store parent PID for composer
		sessionStorage.setItem('replyToPost', parentPid);
		
		// Trigger composer with parent context
		hooks.fire('action:composer.addQuote', {
			text: '',
			parentPid: parentPid
		});
	}
	
	function toggleThread($thread) {
		const $children = $thread.find('.threaded-children').first();
		const $toggle = $thread.find('.thread-toggle').first();
		
		if ($children.is(':visible')) {
			$children.hide();
			$toggle.find('i').removeClass('fa-minus').addClass('fa-plus');
		} else {
			$children.show();
			$toggle.find('i').removeClass('fa-plus').addClass('fa-minus');
		}
	}
	
	// Hook into post rendering for threaded posts
	hooks.on('action:posts.loaded', function (data) {
		if (currentViewMode === 'threaded') {
			// Re-apply threading classes after posts are loaded
			applyThreadingStyles();
		}
	});
	
	function applyThreadingStyles() {
		// Add CSS classes for threading visualization
		$('.threaded-post').each(function () {
			const depth = parseInt($(this).attr('data-depth'), 10) || 0;
			$(this).css('margin-left', (depth * 30) + 'px');
		});
	}
	
	return Threading;
});