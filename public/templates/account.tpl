
<div class="account-username-box" data-userslug="{userslug}">

</div>

<div class="account">

	<div class="row">
		<div class="col-md-5 account-block">

			<div class="text-center account-picture-block panel panel-default">
				<div class="panel-body">
					<div>
						<a href="{relative_path}/user/{userslug}"><img src="{picture}" class="user-profile-picture img-thumbnail"/></a>
					</div>

					<div>
						<div>
							<span>
								<i class="account-online-status fa fa-circle status offline" title="[[global:{status}]]"></i>
								<span class="account-username"> {username}</span>
							</span>
						</div>

						<!-- IF banned -->
						<div>
							<span class="label label-danger">[[user:banned]]</span>
						</div>
						<!-- ENDIF banned -->
						<div>
							<a id="chat-btn" href="#" class="btn btn-primary hide">[[user:chat]]</a>
							<a id="follow-btn" href="#" class="btn btn-success hide">[[user:follow]]</a>
							<a id="unfollow-btn" href="#" class="btn btn-warning hide">[[user:unfollow]]</a>
						</div>
					</div>
				</div>
			</div>

			<div class="text-center account-stats panel panel-default">
				<div class="panel-body">
					<div class="inline-block text-center">
						<div class="human-readable-number" title="{reputation}">{reputation}</div>
						<div class="account-bio-label">[[user:reputation]]</div>
					</div>

					<div class="inline-block text-center">
						<div class="human-readable-number" title="{postcount}">{postcount}</div>
						<div class="account-bio-label">[[user:posts]]</div>
					</div>

					<div class="inline-block text-center">
						<div class="human-readable-number" title="{profileviews}">{profileviews}</div>
						<div class="account-bio-label">[[user:profile_views]]</div>
					</div>
				</div>
			</div>

			<div class="panel panel-default">
				<div class="panel-body">

					<!-- IF email -->
					<span class="account-bio-label">[[user:email]]</span>
					<span class="account-bio-value"><i class="fa fa-eye-slash {emailClass}" title="[[user:email_hidden]]"></i> {email}</span>
					<!-- ENDIF email -->

					<!-- IF fullname -->
					<span class="account-bio-label">[[user:fullname]]</span>
					<span class="account-bio-value">{fullname}</span>
					<!-- ENDIF fullname -->

					<!-- IF websiteName -->
					<span class="account-bio-label">[[user:website]]</span>
					<span class="account-bio-value"><a href="{website}">{websiteName}</a></span>
					<!-- ENDIF websiteName -->

					<!-- IF location -->
					<span class="account-bio-label">[[user:location]]</span>
					<span class="account-bio-value">{location}</span>
					<!-- ENDIF location -->

					<!-- IF age -->
					<span class="account-bio-label">[[user:age]]</span>
					<span class="account-bio-value">{age}</span>
					<!-- ENDIF age -->


					<span class="account-bio-label">[[user:followers]]</span>
					<span class="human-readable-number account-bio-value" title="{followerCount}">{followerCount}</span>

					<span class="account-bio-label">[[user:following]]</span>
					<span class="human-readable-number account-bio-value"  title="{followingCount}">{followingCount}</span>

					<span class="account-bio-label">[[user:joined]]</span>
					<span class="timeago account-bio-value" title="{joindate}"></span>

					<span class="account-bio-label">[[user:lastonline]]</span>
					<span class="timeago account-bio-value" title="{lastonline}"></span>

					<!-- IF !disableSignatures -->
					<!-- IF signature -->
					<hr/>
					<span class="account-bio-label">[[user:signature]]</span>
					<div class="post-signature">
						<span id='signature'>{signature}</span>
					</div>
					<!-- ENDIF signature -->
					<!-- ENDIF !disableSignatures -->
				</div>
			</div>

			<!-- IF ips.length -->
			<div class="panel panel-default">
				<div class="panel-heading">
					<h3 class="panel-title">[[global:recentips]]</h3>
				</div>
				<div class="panel-body">
				<!-- BEGIN ips -->
					<div>{ips.ip}</div>
				<!-- END ips -->
				</div>
			</div>
			<!-- ENDIF ips.length -->

		</div>


		<div class="col-md-7 user-recent-posts">
			<div class="topic-row panel panel-default clearfix">
				<div class="panel-heading">
					<h3 class="panel-title">[[global:recentposts]]</h3>
				</div>
				<div class="panel-body">
					<!-- IF !posts.length -->
					<span>[[user:has_no_posts]]</span>
					<!-- ENDIF !posts.length -->
					<!-- BEGIN posts -->
					<div class="clearfix">
						<p>{posts.content}</p>
						<small>
							<span class="pull-right">
								<a href="../../topic/{posts.tid}/#{posts.pid}">[[global:posted]]</a>
								[[global:in]]
								<a href="../../category/{posts.categorySlug}">
									<i class="fa {posts.categoryIcon}"></i> {posts.categoryName}
								</a>
								<span class="timeago" title="{posts.relativeTime}"></span>
							</span>
						</small>
					</div>
					<hr/>
					<!-- END posts -->
				</div>
			</div>

		</div>
	</div>

	<br/>
	<div id="user-action-alert" class="alert alert-success hide"></div>

</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-type="boolean" template-variable="isFollowing" value="{isFollowing}" />
