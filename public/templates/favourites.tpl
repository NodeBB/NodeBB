
<div class="well">



	<div class="account-username-box" data-userslug="{userslug}">
		<span class="account-username">
			<a href="/users/{userslug}">{username}</a>
		</span>
	</div>

	<div id="no-favourites-notice" class="alert alert-warning {show_nofavourites}">You don't have any favourites, favourite some posts to see them here!</div>

	<div class="row-fluid">
		<div class="span12 user-favourite-posts">
			<!-- BEGIN posts -->
			<div class="topic-row img-polaroid clearfix" topic-url="topic/{posts.tid}/#{posts.pid}">
				<span><strong>{posts.username}</strong> : </span>
				<span>{posts.content}</span>
				<div>
					<span class="pull-right">{posts.relativeTime} ago</span>
				</div>
			</div>
			<br/>
			<!-- END posts -->
		</div>
	</div>


</div>


<script type="text/javascript" src="{relative_path}/src/forum/accountheader.js"></script>
<script type="text/javascript" src="{relative_path}/src/forum/favourites.js"></script>