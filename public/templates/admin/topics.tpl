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
		<a target="_blank" href="{relative_path}/topic/{topics.slug}">{topics.title}</a>
		<ul>
			<li><i class="icon-time"></i> Posted {topics.relativeTime} ago by {topics.username}</li>
			<li><i class="icon-comments"></i> {topics.postcount} post(s)</li>
		</ul>
		<div class="clear"></div>
	</li>
	<!-- END topics -->
</ul>

<div class="text-center">
	<button id="topics_loadmore" class="btn btn-large">Load More Topics</button>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/admin/topics.js"></script>