
<div class="well account">

	<div class="account-username-box" data-userslug="{userslug}">
		<span class="account-username">
			<a href="/user/{userslug}">{username}</a>
		</span>
	</div>

	<div class="row">
		<div class="col-md-2 account-block" style="text-align: center; margin-bottom:20px;">
			<div class="account-picture-block">
				<img src="{picture}" class="user-profile-picture img-thumbnail"/>
			</div>
			<div class="account-online-status">
				<span><i class="fa fa-circle-o"></i> <span>[[user:offline]]</span></span>
			</div>
			<!-- IF banned -->
			<div>
				<span class="label label-danger">[[user:banned]]</span>
			</div>
			<!-- ENDIF banned -->
			<div id="user-actions">
				<a id="follow-btn" href="#" class="btn btn-default">Follow</a>
				<a id="unfollow-btn" href="#" class="btn btn-default">Unfollow</a>
			</div>
		</div>

		<div class="col-md-4">
			<div class="inline-block">
				<div class="account-bio-block">
					<span class="account-bio-label">[[user:email]]</span><i class="fa fa-eye-slash {emailClass}" title="Email hidden"></i>
					<span>{email}</span>
					<br/>

					<span class="account-bio-label">[[user:fullname]]</span>
					<span>{fullname}</span>
					<br/>

					<span class="account-bio-label">[[user:website]]</span>
					<span><a href="{website}">{websiteName}</a></span>
					<br/>

					<span class="account-bio-label">[[user:location]]</span>
					<span>{location}</span>
					<br/>

					<span class="account-bio-label">[[user:age]]</span>
					<span>{age}</span>
					<br/>
					<hr/>
					<span class="account-bio-label">[[user:joined]]</span>
					<span class="timeago" title="{joindate}"></span>
					<br/>

					<span class="account-bio-label">[[user:profil_views]]</span>
					<span class="formatted-number">{profileviews}</span>
					<br/>

					<span class="account-bio-label">[[user:reputation]]</span>
					<span class="formatted-number">{reputation}</span>
					<br/>

					<span class="account-bio-label">[[user:posts]]</span>
					<span class="formatted-number">{postcount}</span>
					<br/>

					<span class="account-bio-label">[[user:followers]]</span>
					<span class="formatted-number">{followerCount}</span>
					<br/>

					<span class="account-bio-label">[[user:following]]</span>
					<span class="formatted-number">{followingCount}</span>
					<br/>

					<hr/>
					<span class="account-bio-label">[[user:signature]]</span>
					<div class="post-signature">
						<span id='signature'>{signature}</span>
					</div>
				</div>
			</div>
		</div>

		<div class="col-md-6 user-recent-posts">
			<!-- BEGIN posts -->
			<div class="topic-row img-thumbnail clearfix" topic-url="topic/{posts.tid}/#{posts.pid}">
				<span>{posts.content}</span>
				<span class="pull-right timeago" title="{posts.relativeTime}"></span>
			</div>
			<!-- END posts -->
		</div>
	</div>

	<br/>
	<div id="user-action-alert" class="alert alert-success hide"></div>

</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-type="boolean" template-variable="isFollowing" value="{isFollowing}" />
