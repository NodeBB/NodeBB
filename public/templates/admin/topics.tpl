<h1>Topics</h1>
<hr />

<ul class="nav nav-pills">
	<li class='active'><a href='/admin/topics'>All</a></li>
	<li class=''><a href='/admin/topics/latest'>Latest</a></li>
	<li class=''><a href='/admin/topics/active'>Active</a></li>
</ul>


<ul class="topic-container">
<!-- BEGIN topics -->
<a href="../../topic/{topics.slug}"><li class="topic-row">
	<div class="row" style="margin: 0">
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
				<h3><span class="badge badge-important">3</span> {topics.title} <small>24<i class="icon-star"></i></small></h3> 
				<p> Posted {topics.relativeTime} ago by 
					<span class="username">{topics.username}</span>. {topics.post_count} posts.</p>
			</div>
		</div>
	</div>
</li></a>
<!-- END topics -->
</ul>

<script type="text/javascript">

//DRY Failure. this needs to go into an ajaxify onready style fn. Currently is copy pasted into every single function so after ACP is off the ground fix asap 
(function() {
	jQuery('document').ready(function() {
		var url = window.location.href,
			parts = url.split('/'),
			active = parts[parts.length-1];

		jQuery('.nav-pills li').removeClass('active');
		jQuery('.nav-pills li a').each(function() {
			if (this.getAttribute('href').match(active)) {
				jQuery(this.parentNode).addClass('active');
				return false;
			}
		})
	});
	
}());
</script>