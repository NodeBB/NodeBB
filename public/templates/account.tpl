
<div class="well">
   


  <div class="account-username-box">
		<span class="account-username">
			<a href="/users/{userslug}">{username}</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="settingsLink" class="pull-right"><a href="/users/{userslug}/settings">settings</a></span>
			<span class="pull-right"><a href="/users/{userslug}/followers">followers</a></span>
			<span class="pull-right"><a href="/users/{userslug}/following">following</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{userslug}/edit">edit</a></span>
		</div>
	</div>
		

	<div class="row-fluid">
		<div class="span2" style="text-align: center; margin-bottom:20px;">
			<div class="account-picture-block">
				<img src="{picture}" class="user-profile-picture img-polaroid"/>
			</div>
			<div class="account-online-status">
				<span><i class="icon-circle-blank"></i> <span>offline</span></span>
			</div>
			<div id="user-actions">
				<a id="follow-btn" href="#" class="btn">Follow</a>
			</div>
		</div>
	
		<div class="span4">
			<h4>profile</h4>
			<div class="inline-block">
				<div class="account-bio-block">
					<span class="account-bio-label">email</span>
					<span>{email}</span>
					<br/>
					
					<span class="account-bio-label">full name</span>
					<span>{fullname}</span>
					<br/>
					
					<span class="account-bio-label">website</span>
					<span><a href="{website}">{website}</a></span>
					<br/>
					
					<span class="account-bio-label">location</span>
					<span>{location}</span>
					<br/>
					
					<span class="account-bio-label">age</span>
					<span>{age}</span>
					<br/>
					<hr/>
					<span class="account-bio-label">member for</span>
					<span>{joindate}</span>
					<br/>

					<span class="account-bio-label">reputation</span>
					<span id='reputation'>{reputation}</span>
					<br/>		
					
					<span class="account-bio-label">posts</span>
					<span id='postcount'>{postcount}</span>
					<br/>
					
					<span class="account-bio-label">followers</span>
					<span>{followerCount}</span>
					<br/>
					
					<span class="account-bio-label">following</span>
					<span>{followingCount}</span>
					<br/>
					
					<hr/>
					<span class="account-bio-label">signature</span>
					<div class="post-signature">
						<span id='signature'>{signature}</span>
					</div>
				</div>
			</div>
		</div>
		
		<div class="span6 user-recent-posts">
			<h4>recent posts </h4>
			<!-- BEGIN posts -->
			<div class="topic-row img-polaroid clearfix" topic-url="topic/{posts.tid}/{posts.pid}">
				<span>{posts.content}</span>
				<span class="pull-right">{posts.relativeTime} ago</span>
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

<script type="text/javascript" src="{relative_path}/src/forum/account.js"></script>