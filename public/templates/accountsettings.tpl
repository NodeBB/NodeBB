<div class="well account">

	<div class="account-username-box" data-userslug="{userslug}">
		<span class="account-username">
			<a href="{relative_path}/user/{userslug}">{username}</a> <i class="fa fa-chevron-right"></i>
			<a href="{relative_path}/user/{userslug}/settings">[[user:settings]]</a>
		</span>
	</div>

	<div class="row">
		<div class="col-md-6">
			<h4>privacy</h4>
			<div class="checkbox">
				<label>
	      			<input id="showemailCheckBox" type="checkbox" {showemail}> [[user:show_email]]
	    		</label>
	    	</div>
		</div>

		<div class="col-md-6">

		</div>
	</div>
	<div class="form-actions">
		<a id="submitBtn" href="#" class="btn btn-primary">[[global:save_changes]]</a>
	</div>
</div>
