
<div class="well">
   


	<div class="account-username-box">
		<span class="account-username">
			<a href="/users/{username}">{username}</a> >
			<a href="/users/{username}/followers">followers</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="followersLink" class="pull-right"><a href="/users/{username}/followers">followers</a></span>
			<span id="followingLink" class="pull-right"><a href="/users/{username}/following">following</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{username}/edit">edit</a></span>
		</div>
	</div>

	<div>
	    <!-- BEGIN followers -->

	    <div class="users-box well">
		 	<a href="/users/{followers.username}">
			    <img src="{followers.picture}" class="user-8080-picture"/>
		    </a>
		    <br/>
			<a href="/users/{followers.username}">{followers.username}</a>
		    <br/>
			<div title="reputation">
				<span class='reputation'>{followers.reputation}</span>
				<i class='icon-star'></i>
			</div>
			<div title="post count">
				<span class='postcount'>{followers.postcount}</span>
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

<script type="text/javascript" src="/src/forum/followers.js"></script>