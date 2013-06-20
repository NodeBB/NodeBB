<h1>Topics</h1>
<hr />

<ul class="topics">
	<!-- BEGIN topics -->
	<li data-tid="{topics.tid}" data-locked="{topics.locked}" data-pinned="{topics.pinned}" data-deleted="{topics.deleted}">
		<div class="btn-group pull-right">
			<button data-action="pin" class="btn"><i class="icon-pushpin"></i></button>
			<button data-action="lock" class="btn"><i class="icon-lock"></i></button>
			<button data-action="delete" class="btn"><i class="icon-trash"></i></button>
		</div>
		<a target="_blank" href="../../topic/{topics.slug}">{topics.title}</a>
		<ul>
			<li><i class="icon-time"></i> Posted {topics.relativeTime} ago by {topics.username}</li>
			<li><i class="icon-comments"></i> {topics.post_count} post(s)</li>
		</ul>
		<div class="clear"></div>
	</li>
	<!-- END topics -->
</ul>

<script type="text/javascript" src="../../src/forum/admin/topics.js"></script>