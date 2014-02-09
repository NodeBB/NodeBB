<div class="account-username-box clearfix" data-userslug="{userslug}">

</div>

<div class="users account">
	<div>
		<!-- BEGIN following -->
		<div class="users-box">
			<a href="../../user/{following.userslug}"><img src="{following.picture}" class="img-thumbnail"/></a>
			<br/>
			<div class="user-info">
				<a href="../../user/{following.userslug}">{following.username}</a>
				<br/>
				<div title="reputation" class="reputation">
					<span class='formatted-number'>{following.reputation}</span>
					<i class='fa fa-star'></i>
				</div>
				<div title="post count" class="post-count">
					<span class='formatted-number'>{following.postcount}</span>
					<i class='fa fa-pencil'></i>
				</div>
			</div>
		</div>

		<!-- END following -->
	</div>
	<div id="no-following-notice" class="alert alert-warning hide">[[user:follows_no_one]]</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-variable="followingCount" value="{followingCount}" />
