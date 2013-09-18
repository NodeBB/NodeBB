
<div class="well users">

	<div class="account-username-box" data-userslug="{userslug}">
		<span class="account-username">
			<a href="/user/{userslug}">{username}</a> <i class="icon-chevron-right"></i>
			<a href="/user/{userslug}/following">following</a>
		</span>
	</div>

	<div>
		<!-- BEGIN following -->
		<div class="users-box">
			<a href="/user/{following.userslug}">
				<img src="{following.picture}" class="img-thumbnail"/>
			</a>
			<br/>
			<a href="/user/{following.userslug}">{following.username}</a>
			<br/>
			<div title="reputation">
				<span class='formatted-number'>{following.reputation}</span>
				<i class='icon-star'></i>
			</div>
			<div title="post count">
				<span class='formatted-number'>{following.postcount}</span>
				<i class='icon-pencil'></i>
			</div>
			<a id="unfollow-btn" href="#" class="btn btn-default unfollow-btn" followingUid="{following.uid}" data-username="{following.username}">Unfollow</a>
		</div>
		<!-- END following -->
	</div>
	<div id="no-following-notice" class="alert alert-warning hide">This user isn't following anyone :(</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-variable="followingCount" value="{followingCount}" />

<script type="text/javascript" src="{relative_path}/src/forum/following.js"></script>
<script type="text/javascript" src="{relative_path}/src/forum/accountheader.js"></script>
