<!-- IMPORT partials/breadcrumbs.tpl -->

<div class="row">
	<!-- IF allowLocalLogin -->
	<div class="<!-- IF alternate_logins -->col-md-6<!-- ELSE -->col-md-12<!-- ENDIF alternate_logins -->">
		<div class="well well-lg">
			<div class="alert alert-danger" id="login-error-notify" <!-- IF error -->style="display:block"<!-- ELSE -->style="display: none;"<!-- ENDIF error -->>
				<button type="button" class="close" data-dismiss="alert">&times;</button>
				[[login:failed_login_attempt]]
				<p>{error}</p>
			</div>

			<form class="form-horizontal" role="form" method="post" target="login" id="login-form">
				<div class="form-group">
					<label for="username" class="col-lg-2 control-label">{allowLoginWith}</label>
					<div class="col-lg-10">
						<input class="form-control" type="text" placeholder="{allowLoginWith}" name="username" id="username" autocorrect="off" autocapitalize="off" />
					</div>
				</div>
				<div class="form-group">
					<label for="password" class="col-lg-2 control-label">[[user:password]]</label>
					<div class="col-lg-10">
						<input class="form-control" type="password" placeholder="[[user:password]]" name="password" id="password" />
					</div>
				</div>
				<div class="form-group">
					<div class="col-lg-offset-2 col-lg-10">
						<div class="checkbox">
							<label>
								<input type="checkbox" name="remember" id="remember" checked /> [[login:remember_me]]
							</label>
						</div>
					</div>
				</div>
				<div class="form-group">
					<div class="col-lg-offset-2 col-lg-10">
						<button class="btn btn-primary btn-lg btn-block" id="login" type="submit">[[global:login]]</button>
						<!-- IF allowRegistration -->
						<span>[[login:dont_have_account]] <a href="{config.relative_path}/register">[[register:register]]</a></span>
						<!-- ENDIF allowRegistration -->
						&nbsp; <a id="reset-link" href="{config.relative_path}/reset">[[login:forgot_password]]</a>
					</div>
				</div>
			</form>

		</div>
	</div>
	<!-- ENDIF allowLocalLogin -->

	<!-- IF alternate_logins -->
	<div class="<!-- IF allowLocalLogin -->col-md-6<!-- ELSE -->col-md-12<!-- ENDIF allowLocalLogin -->">
		<div class="well well-lg">
			<!-- <h4>[[login:alternative_logins]]</h4> -->
			<h4>Smith Micro Graphics login</h4>
			<ul class="alt-logins">
				<!-- BEGIN authentication -->
                <li class="{authentication.name}">
                <div class="login-button">
                    <a rel="nofollow" target="_top" href="{config.relative_path}{authentication.url}">
                        <i class="fa {authentication.icon} fa-3x"></i>
                    </a>
                </div>
                <div class="description">
                    To connect to our forum, please <a href="https://forum.smithmicro.com/auth/smgraphics">use your Smith Micro Graphics account</a>.<br>If you don’t have one yet, you can <a href="https://pgportal.smithmicro.com/#!/signup">sign up here</a>.
                </div>
                </li>
                <!-- END authentication -->
			</ul>
		</div>
	</div>
	<!-- ENDIF alternate_logins -->
</div>
