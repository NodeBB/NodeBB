<ol class="breadcrumb">
	<li itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<a href="{relative_path}/" itemprop="url"><span itemprop="title">[[global:home]]</span></a>
	</li>
	<li class="active" itemscope="itemscope" itemtype="http://data-vocabulary.org/Breadcrumb">
		<span itemprop="title">[[register:register]]</span>
	</li>
</ol>

<div class="row">
	<div class="{register_window:spansize}">
		<div class="well well-lg">
			<form class="form-horizontal" role="form" action="{relative_path}/register" method="post">
				<div class="form-group">
					<label for="email" class="col-lg-4 control-label">[[register:email_address]]</label>
					<div class="col-lg-8">
						<div class="input-group">
							<input class="form-control" type="text" placeholder="[[register:email_address_placeholder]]" name="email" id="email" />
					        <span class="input-group-addon">
					        	<span id="email-notify"><i class="fa fa-circle-o"></i></span>
					        </span>
						</div>
						<span class="help-block">[[register:help.email]]</span>
					</div>
				</div>
				<div class="form-group">
					<label for="username" class="col-lg-4 control-label">[[register:username]]</label>
					<div class="col-lg-8">
						<div class="input-group">
							<input class="form-control" type="text" placeholder="[[register:username_placeholder]]" name="username" id="username" />
					        <span class="input-group-addon">
					        	<span id="username-notify"><i class="fa fa-circle-o"></i></span>
					        </span>
						</div>
						<span class="help-block">[[register:help.username_restrictions, {minimumUsernameLength}, {maximumUsernameLength}]]</span>
					</div>
				</div>
				<div class="form-group">
					<label for="password" class="col-lg-4 control-label">[[register:password]]</label>
					<div class="col-lg-8">
						<div class="input-group">
							<input class="form-control" type="password" placeholder="[[register:password_placeholder]]" name="password" id="password" />
					        <span class="input-group-addon">
					        	<span id="password-notify"><i class="fa fa-circle-o"></i></span>
					        </span>
						</div>
						<span class="help-block">[[register:help.minimum_password_length, {minimumPasswordLength}]]</span>
					</div>
				</div>
				<div class="form-group">
					<label for="password-confirm" class="col-lg-4 control-label">[[register:confirm_password]]</label>
					<div class="col-lg-8">
						<div class="input-group">
							<input class="form-control" type="password" placeholder="[[register:confirm_password_placeholder]]" name="password-confirm" id="password-confirm" />
							<span class="input-group-addon">
								<span id="password-confirm-notify"><i class="fa fa-circle-o"></i></span>
							</span>
						</div>
					</div>
				</div>
				<!-- IF termsOfUse -->
				<div class="form-group">
					<label class="col-lg-4 control-label">&nbsp;</label>
					<div class="col-lg-8">
						<hr />
						<strong>[[register:terms_of_use]]</strong>
						<textarea readonly class="form-control" rows=6>{termsOfUse}</textarea>
						<div class="checkbox">
							<label>
								<input type="checkbox" name="agree-terms" id="agree-terms"> [[register:agree_to_terms_of_use]]
							</label>
						</div>
					</div>
				</div>
				<!-- ENDIF termsOfUse -->
				<div class="form-group">
					<div class="col-lg-offset-4 col-lg-8">
						<hr />
						<button class="btn btn-primary btn-lg btn-block" id="register" type="submit">[[register:register_now_button]]</button>
					</div>
				</div>
				<input type="hidden" name="_csrf" value="{token}" />
				<input id="referrer" type="hidden" name="referrer" value="" />
			</form>
		</div>
	</div>

	<!-- IF alternate_logins -->
	<div class="col-md-6">
		<div class="well well-lg">
			<h4>[[register:alternative_registration]]</h4>
			<ul class="alt-logins">
				<!-- BEGIN authentication -->
				<li class="{authentication.name}"><a rel="nofollow" href="{authentication.url}"><i class="fa fa-{authentication.icon}-square fa-3x"></i></a></li>
				<!-- END authentication -->
			</ul>
		</div>
	</div>
	<!-- ENDIF alternate_logins -->
</div>
