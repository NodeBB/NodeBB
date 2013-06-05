
<div class="well">
   


  <div class="account-username-box">
		<span class="account-username">
			<a href="/users/{username}">{username}</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="friendsLink" class="pull-right"><a href="/users/{username}/friends">friends</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{username}/edit">edit</a></span>
		</div>
	</div>
		

	<div class="row-fluid">
		<div class="span3" style="text-align: center; margin-bottom:20px;">
			<div class="account-picture-block">
				<img src="{picture}" class="user-profile-picture"/>
			</div>
		</div>
	
		<div class="span9">
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
					<hr/>
					<span class="account-bio-label">signature</span>
					<div class="post-signature">
						<span id='signature'>{signature}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
	<div id="user-actions" class="container">
		<a id="add-friend-btn" href="#" class="btn">Follow</a>
	</div>
	<br/>
	<div id="user-action-alert" class="alert alert-success hide"></div>

</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />
<input type="hidden" template-variable="isFriend" value="{isFriend}" />

<script type="text/javascript" src="/src/forum/account.js"></script>