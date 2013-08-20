
<div class="well">

	<div class="account-username-box" data-userslug="{userslug}">
		<span class="account-username">
			<a href="/users/{userslug}">{username}</a> <i class="icon-chevron-right"></i>
			<a href="/users/{userslug}/followers">followers</a>
		</span>
	</div>

	<div>
		<!-- BEGIN followers -->
		<div class="users-box">
			<a href="/users/{followers.userslug}">
				<img src="{followers.picture}" class="img-polaroid"/>
			</a>
			<br/>
			<a href="/users/{followers.userslug}">{followers.username}</a>
			<br/>
			<div title="reputation">
				<span class='formatted-number'>{followers.reputation}</span>
				<i class='icon-star'></i>
			</div>
			<div title="post count">
				<span class='formatted-number'>{followers.postcount}</span>
				<i class='icon-pencil'></i>
			</div>
		</div>
		<!-- END followers -->
	</div>
	<div id="no-followers-notice" class="alert alert-warning hide">This user doesn't have any followers :(</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-variable="followersCount" value="{followersCount}" />

<script type="text/javascript" src="{relative_path}/src/forum/followers.js"></script>
<script type="text/javascript" src="{relative_path}/src/forum/accountheader.js"></script>