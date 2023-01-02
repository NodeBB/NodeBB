<div class="persona-usercard">
	<a href="{config.relative_path}/user/{userslug}">
		<!-- IF picture -->
		<div class="usercard-picture" style="background-image:url({picture})"></div>
		<!-- ELSE -->
		<div class="usercard-picture" style="background-color: {icon:bgColor};">{icon:text}</div>
		<!-- ENDIF picture -->
	</a>
	<div class="usercard-body">
		<a href="{config.relative_path}/user/{userslug}">
			<span class="usercard-name"><!-- IF fullname -->{fullname}<!-- ELSE -->{username}<!-- ENDIF fullname --></span><br />
			<span class="usercard-username"><!-- IF !banned -->@{username}<!-- ELSE -->[[user:banned]]<!-- ENDIF !banned --></span>
			<!-- IF !banned -->
			<i component="user/status" class="fa fa-circle status {status}" title="[[global:{status}]]"></i>
			<!-- ENDIF !banned -->
		</a>

		<div class="row usercard-info">
			<div class="col-xs-4">
				<small>[[global:posts]]</small>
				<span class="human-readable-number">{postcount}</span>
			</div>
			<div class="col-xs-4">
				<small>[[global:reputation]]</small>
				<span class="human-readable-number">{reputation}</span>
			</div>

			<button class="btn-morph persona-fab <!-- IF banned --> hide<!-- ENDIF banned -->">
				<span>
					<span class="s1"></span>
					<span class="s2"></span>
					<span class="s3"></span>
				</span>
			</button>
		</div>
	</div>
</div>