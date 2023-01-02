<div class="account">
	<!-- IMPORT partials/account/header.tpl -->

	<form class="edit-form">
		<!-- disables autocomplete on FF --><input type="password" style="display:none">

		<!-- IF isSelf -->
		<div class="form-group">
			<label class="control-label" for="inputCurrentPassword">[[user:current_password]]</label>
			<div class="controls">
				<input autocomplete="off" class="form-control" type="password" id="inputCurrentPassword" placeholder="[[user:current_password]]" value=""<!-- IF !hasPassword --> disabled<!-- ENDIF !hasPassword -->>
			</div>
		</div>
		<!-- ENDIF isSelf -->

		<div class="form-group">
			<label class="control-label" for="inputNewPassword">[[user:password]]</label>
			<input class="form-control" type="password" id="inputNewPassword" placeholder="[[user:password]]" value="">
			<span class="form-feedback" id="password-notify"></span>
		</div>

		<div class="form-group">
			<label class="control-label" for="inputNewPasswordAgain">[[user:confirm_password]]</label>
			<input class="form-control" type="password" id="inputNewPasswordAgain" placeholder="[[user:confirm_password]]" value="">
			<span class="form-feedback" id="password-confirm-notify"></span>
		</div>
		
		<div class="form-actions">
			<button id="changePasswordBtn" class="btn btn-primary btn-block"><i class="hide fa fa-spinner fa-spin"></i> [[user:change_password]]</button>
		</div>
	</form>
</div>