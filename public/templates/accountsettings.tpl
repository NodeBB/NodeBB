
<div class="well">
	
	<div class="account-username-box">
		<span class="account-username">
			<a href="/users/{userslug}">{username}</a> <i class="icon-chevron-right"></i>
			<a href="/users/{userslug}/settings">settings</a>
		</span>
		<div class="account-sub-links inline-block pull-right">
			<span id="settingsLink" class="pull-right"><a href="/users/{userslug}/settings">settings</a></span>
			<span class="pull-right"><a href="/users/{userslug}/followers">followers</a></span>
			<span class="pull-right"><a href="/users/{userslug}/following">following</a></span>
			<span id="editLink" class="pull-right"><a href="/users/{userslug}/edit">edit</a></span>
		</div>
	</div>

	<div class="row-fluid">
		<div class="span6">
			<h4>privacy</h4>
			<label class="checkbox">
      			<input id="showemailCheckBox" type="checkbox" {showemail}> Show my email
    		</label>
		</div>
		  
		<div class="span6">
			
		</div>
	</div>  
	<div class="form-actions">
		<a id="submitBtn" href="#" class="btn btn-primary">Save changes</a>
	</div>
</div>

<script type="text/javascript" src="{relative_path}/src/forum/accountsettings.js"></script>