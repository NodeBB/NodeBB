<div class="container">
	<ul class="breadcrumb">
		<li><a href="/">Home</a><span class="divider">/</span></li>
		<li class="active">{category_name}</li>
		<div id="category_active_users"></div>
	</ul>
</div>

<ul class="topic-container">
<!-- BEGIN topics -->
<a href="../../topic/{topics.slug}"><li class="topic-row">
	<div class="row">
		<div class="span1 topic-row-icon">
			<i class="icon-lock icon-4x"></i>
			<i class="{topics.pin-icon}"></i><i class="{topics.lock-icon}"></i>
		</div>
		<div class="span11 topic-row-content">
			<div class="top-posters">
				<img src="http://www.gravatar.com/avatar/fd37ce111f863c6665045c2d72d199bf?s=60" class="img-polaroid" />
				<img src="http://www.gravatar.com/avatar/07c9c7170c3ac676c2561e3eeaee063c?s=60" class="img-polaroid" />
				<img src="http://www.gravatar.com/avatar/91050ce0072697b53380c6a03a1bc12a?s=60" class="img-polaroid" />
			</div>
			<div>
				<h3><span class="badge {topics.badgeclass}">{topics.post_count}</span> {topics.title} <small>24<i class="icon-star"></i></small></h3> 
				<p> Posted {topics.relativeTime} ago by 
					<span class="username">{topics.username}</span>.</p>
			</div>
		</div>
	</div>
</li></a>
<!-- END topics -->
</ul>

<hr />
<button id="new_post" class="btn btn-primary btn-large {show_topic_button}">New Topic</button>


<script type="text/javascript">
var new_post = document.getElementById('new_post');
new_post.onclick = function() {
	app.open_post_window('topic', {category_id});
}
</script>