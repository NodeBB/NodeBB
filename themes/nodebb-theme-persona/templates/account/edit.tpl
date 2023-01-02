<div class="account">
	<!-- IMPORT partials/account/header.tpl -->
	<!-- IF sso.length --><div><!-- ENDIF sso.length -->
		<div class="row">
			<div class="col-md-2 col-sm-4">
				<div class="account-picture-block text-center">
					<div class="row">
						<div class="col-xs-12 hidden-xs">
							<!-- IF picture -->
							<img id="user-current-picture" class="avatar avatar-xl avatar-rounded" src="{picture}" />
							<!-- ELSE -->
							<div class="avatar avatar-xl avatar-rounded" style="background-color: {icon:bgColor};">{icon:text}</div>
							<!-- ENDIF picture -->
						</div>
					</div>
					<ul class="list-group">
						<!-- IF allowProfilePicture -->
						<a id="changePictureBtn" href="#" class="list-group-item">[[user:change_picture]]</a>
						<!-- ENDIF allowProfilePicture -->
						<!-- IF !username:disableEdit -->
						<a href="{config.relative_path}/user/{userslug}/edit/username" class="list-group-item">[[user:change_username]]</a>
						<!-- ENDIF !username:disableEdit -->
						<!-- IF !email:disableEdit -->
						<a href="{config.relative_path}/user/{userslug}/edit/email" class="list-group-item">[[user:change_email]]</a>
						<!-- ENDIF !email:disableEdit -->
						<!-- IF canChangePassword -->
						<a href="{config.relative_path}/user/{userslug}/edit/password" class="list-group-item">[[user:change_password]]</a>
						<!-- ENDIF canChangePassword -->
						{{{each editButtons}}}
						<a href="{config.relative_path}{editButtons.link}" class="list-group-item">{editButtons.text}</a>
						{{{end}}}
					</ul>

					<!-- IF config.requireEmailConfirmation -->
					<!-- IF email -->
					<!-- IF isSelf -->
					<a id="confirm-email" href="#" class="btn btn-warning <!-- IF email:confirmed -->hide<!-- ENDIF email:confirmed -->">[[user:confirm_email]]</a><br/><br/>
					<!-- ENDIF isSelf -->
					<!-- ENDIF email -->
					<!-- ENDIF config.requireEmailConfirmation -->

					<!-- IF allowAccountDelete -->
					<!-- IF isSelf -->
					<a id="deleteAccountBtn" href="#" class="btn btn-danger">[[user:delete_account]]</a><br/><br/>
					<!-- ENDIF isSelf -->
					<!-- ENDIF allowAccountDelete -->

				</div>
			</div>

			<div class="<!-- IF !sso.length -->col-md-9 col-sm-8<!-- ELSE -->col-md-5 col-sm-4<!-- ENDIF !sso.length -->">
				<form role="form" component="profile/edit/form">
					<div class="form-group">
						<label for="fullname">[[user:fullname]]</label>
						<input class="form-control" type="text" id="fullname" name="fullname" placeholder="[[user:fullname]]" value="{fullname}">
					</div>
					<!-- IF allowWebsite -->
					<div class="form-group">
						<label for="website">[[user:website]]</label>
						<input class="form-control" type="text" id="website" name="website" placeholder="http://..." value="{website}">
					</div>
					<!-- ENDIF allowWebsite -->

					<div class="form-group">
						<label for="location">[[user:location]]</label>
						<input class="form-control" type="text" id="location" name="location" placeholder="[[user:location]]" value="{location}">
					</div>

					<div class="form-group">
						<label for="birthday">[[user:birthday]]</label>
						<input class="form-control" type="date" id="birthday" name="birthday" value="{birthday}" placeholder="mm/dd/yyyy">
					</div>

					<div class="form-group">
						<label for="groupTitle">[[user:grouptitle]]</label>

						<select class="form-control" id="groupTitle" name="groupTitle" <!-- IF allowMultipleBadges --> size="{groupSelectSize}" multiple<!-- ENDIF allowMultipleBadges -->>
							<option value="">[[user:no-group-title]]</option>
							{{{each groups}}}
							<!-- IF groups.userTitleEnabled -->
							<option value="{groups.displayName}" <!-- IF groups.selected -->selected<!-- ENDIF groups.selected -->>{groups.userTitle}</option>
							<!-- ENDIF groups.userTitleEnabled -->
							{{{end}}}
						</select>
						<!-- IF allowMultipleBadges -->
						<span>[[user:group-order-help]]</span>
						<i role="button" component="group/order/up" class="fa fa-chevron-up"></i> <i role="button" component="group/order/down" class="fa fa-chevron-down"></i>
						<!-- ENDIF -->
					</div>

					<!-- IF allowAboutMe -->
					<div class="form-group">
						<label for="aboutme">[[user:aboutme]]</label> <small><label id="aboutMeCharCountLeft"></label></small>
						<textarea class="form-control" id="aboutme" name="aboutme" rows="5">{aboutme}</textarea>
					</div>
					<!-- ENDIF allowAboutMe -->

					<!-- IF allowSignature -->
					<!-- IF !disableSignatures -->
					<div class="form-group">
						<label for="signature">[[user:signature]]</label> <small><label id="signatureCharCountLeft"></label></small>
						<textarea class="form-control" id="signature" name="signature" rows="5">{signature}</textarea>
					</div>
					<!-- ENDIF !disableSignatures -->
					<!-- ENDIF allowSignature -->

					<a id="submitBtn" href="#" class="btn btn-primary">[[global:save_changes]]</a>
				</form>

				<hr class="visible-xs visible-sm"/>
			</div>

			<!-- IF sso.length -->
			<div class="col-md-5 col-sm-4">
				<label>[[user:sso.title]]</label>
				<div class="list-group">
					{{{each sso}}}
					<div class="list-group-item">
						<!-- IF ../deauthUrl -->
						<a data-component="{../component}" class="btn btn-default btn-xs pull-right" href="{../deauthUrl}">[[user:sso.dissociate]]</a>
						<!-- END -->
						<a data-component="{../component}" href="{../url}" target="<!-- IF ../associated -->_blank<!-- ELSE -->_top<!-- ENDIF ../associated -->">
							<!-- IF ../icon --><i class="fa {../icon}"></i><!-- ENDIF ../icon -->
							<!-- IF ../associated -->[[user:sso.associated]]<!-- ELSE -->[[user:sso.not-associated]]<!-- ENDIF ../associated -->
							{../name}
						</a>
					</div>
					{{{end}}}
				</div>
			</div>
			<!-- ENDIF sso.length -->
		</div>
	<!-- IF sso.length --></div><!-- ENDIF sso.length -->
</div>

