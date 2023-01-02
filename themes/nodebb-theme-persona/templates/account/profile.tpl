<div class="account">
	<!-- IMPORT partials/account/header.tpl -->

	<div class="profile row">
		<h1 class="fullname"><!-- IF fullname -->{fullname}<!-- ELSE -->{username}<!-- ENDIF fullname --></h1>
		<h2 class="username"><!-- IF !banned -->@{username}<!-- ELSE -->[[user:banned]]<!-- ENDIF !banned --></h2>
		<!-- IF isAdminOrGlobalModeratorOrModerator -->
		<!-- IF banned -->
		<div class="text-center">
		<!-- IF banned_until -->
		[[user:info.banned-until, {banned_until_readable}]]
		<!-- ELSE -->
		[[user:info.banned-permanently]]
		<!-- ENDIF banned_until -->
		</div>
		<!-- ENDIF banned -->
		<!-- ENDIF isAdminOrGlobalModeratorOrModerator -->

		<!-- IF selectedGroup.length -->
		<div class="text-center">
		{{{each selectedGroup}}}
		<!-- IF selectedGroup.slug -->
			<a href="{config.relative_path}/groups/{selectedGroup.slug}"><small class="label group-label inline-block" style="color:{selectedGroup.textColor};background-color: {selectedGroup.labelColor};"><!-- IF selectedGroup.icon --><i class="fa {selectedGroup.icon}"></i> <!-- ENDIF selectedGroup.icon -->{selectedGroup.userTitle}</small></a>
		<!-- ENDIF selectedGroup.slug -->
		{{{end}}}
		</div>
		<br/>
		<!-- ENDIF selectedGroup.length -->

		<!-- IF aboutme -->
		<span component="aboutme" class="text-center aboutme">{aboutmeParsed}</span>
		<!-- ENDIF aboutme -->

		<div class="account-stats">
			<!-- IF !reputation:disabled -->
			<div class="stat">
				<div class="human-readable-number" title="{reputation}">{reputation}</div>
				<span class="stat-label">[[global:reputation]]</span>
			</div>
			<!-- ENDIF !reputation:disabled -->

			<div class="stat">
				<div class="human-readable-number" title="{profileviews}">{profileviews}</div>
				<span class="stat-label">[[user:profile_views]]</span>
			</div>

			<div class="stat">
				<div><a class="human-readable-number" title="{counts.posts}" href="{config.relative_path}/user/{userslug}/posts">{counts.posts}</a></div>
				<span class="stat-label">[[global:posts]]</span>
			</div>

			<div class="stat">
				<div><a class="human-readable-number" title="{counts.followers}" href="{config.relative_path}/user/{userslug}/followers">{counts.followers}</a></div>
				<span class="stat-label">[[user:followers]]</span>
			</div>

			<div class="stat">
				<div><a class="human-readable-number" title="{counts.following}" href="{config.relative_path}/user/{userslug}/following">{counts.following}</a></div>
				<span class="stat-label">[[user:following]]</span>
			</div>
		</div>

		<div class="text-center profile-meta">
			<span>[[user:joined]]</span>
			<strong class="timeago" title="{joindateISO}"></strong>

			<span>[[user:lastonline]]</span>
			<strong class="timeago" title="{lastonlineISO}"></strong><br />

			<!-- IF email -->
			<span>[[user:email]]</span>
			<strong><i class="fa fa-eye-slash {emailClass}" title="[[user:email_hidden]]"></i> {email}</strong>
			<!-- ENDIF email -->

			<!-- IF websiteName -->
			<span>[[user:website]]</span>
			<strong><a href="{websiteLink}" rel="nofollow noopener noreferrer">{websiteName}</a></strong>
			<!-- ENDIF websiteName -->

			<!-- IF location -->
			<span>[[user:location]]</span>
			<strong>{location}</strong>
			<!-- ENDIF location -->

			<!-- IF age -->
			<span>[[user:age]]</span>
			<strong>{age}</strong>
			<!-- ENDIF age -->
		</div>
	</div>


	<hr />

	<div class="row">
		<div class="col-xs-12 account-block hidden">
			<div class="account-picture-block text-center">
				<span>
					<span class="account-username"> {username}</span>
				</span>

				<!-- IF !isSelf -->
				<a component="account/unfollow" href="#" class="btn btn-default{{{ if !isFollowing }}} hide{{{ end }}}">[[user:unfollow]]</a>
				<a component="account/follow" href="#" class="btn btn-primary{{{ if isFollowing }}} hide{{{ end }}}">[[user:follow]]</a>
				<!-- ENDIF !isSelf -->
			</div>
		</div>
	</div>

	<!-- IF groups.length -->
	<div class="row">
		<div class="col-xs-12 hidden">
			{{{each groups}}}
			<a href="{config.relative_path}/groups/{groups.slug}"><span class="label group-label inline-block" style="background-color: {groups.labelColor};"><!-- IF groups.icon --><i class="fa {groups.icon}"></i> <!-- ENDIF groups.icon -->{groups.userTitle}</span></a>
			{{{end}}}
		</div>
	</div>
	<!-- ENDIF groups.length -->

	<!-- IF ips.length -->
	<div class="row">
		<div class="col-xs-12 hidden">
			<div class="panel-heading">
				<h3 class="panel-title">[[global:recentips]]</h3>
			</div>
			<div class="panel-body">
			{{{each ips}}}
				<div>{ips}</div>
			{{{end}}}
			</div>
		</div>
	</div>
	<!-- ENDIF ips.length -->

	<div class="row">
		{{{ if bestPosts.length }}}
		<div class="col-lg-12 col-xs-12">
			<h1>[[pages:account/best, {username}]]</h1>

			<div class="col-xs-12">
				<ul component="posts" class="posts-list">
				{{{each bestPosts}}}
				<!-- IMPORT partials/posts_list_item.tpl -->
				{{{end}}}
				</ul>
			</div>
		</div>
		{{{ end }}}
		{{{ if latestPosts.length}}}
		<div class="col-lg-12 col-xs-12">
			<h1>[[pages:account/latest-posts, {username}]]</h1>
			<div class="col-xs-12">
				<ul component="posts" class="posts-list">
				{{{each latestPosts}}}
				<!-- IMPORT partials/posts_list_item.tpl -->
				{{{end}}}
				</ul>
			</div>
		</div>
		{{{ end }}}
	</div>

	<div id="user-action-alert" class="alert alert-success hide"></div>
</div>
