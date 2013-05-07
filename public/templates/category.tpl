<button id="new_post" class="btn btn-primary btn-large {show_topic_button}">New Topic</button>
<ul class="topic-container">
<!-- BEGIN topics -->
<a href="../../topic/{topics.slug}"><li class="topic-row">
	<h4><i class="{topics.icon}"></i> {topics.title}</h4>
	<p>Posted {topics.relativeTime} ago by <span class="username">{topics.username}</span>. {topics.post_count} posts.</p>
</li></a>
<!-- END topics -->
</ul>
<script type="text/javascript">
var new_post = document.getElementById('new_post');
new_post.onclick = function() {
	app.open_post_window('topic', {category_id});
}
</script>