<div class="manage-users">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-user"></i> [[admin:users.users]]</div>
			<div class="panel-body">
				<ul class="nav nav-pills">
					<li class='active'><a href='{config.relative_path}/admin/manage/users/latest'>[[admin:users.latest_users]]</a></li>
					<li class=''><a href='{config.relative_path}/admin/manage/users/sort-posts'>[[admin:users.top_posters]]</a></li>
					<li class=''><a href='{config.relative_path}/admin/manage/users/sort-reputation'>[[admin:users.most_reputation]]</a></li>
					<li class=''><a href='{config.relative_path}/admin/manage/users/banned'>[[admin:users.banned]]</a></li>
					<li class=''><a href='{config.relative_path}/admin/manage/users/registration'>[[admin:users.registration_queue]]</a></li>
					<li class=''><a href='{config.relative_path}/admin/manage/users/search'>[[admin:users.user_search]]</a></li>


					<div class="btn-group pull-right">
						<button class="btn btn-default dropdown-toggle" data-toggle="dropdown" type="button">[[admin:users.edit]] <span class="caret"></span></button>
						<ul class="dropdown-menu">
							<li><a href="#" class="admin-user"><i class="fa fa-fw fa-shield"></i> [[admin:users.make_admin]]</a></li>
							<li><a href="#" class="remove-admin-user"><i class="fa fa-fw fa-ban"></i> [[admin:users.remove_admin]]</a></li>
							<li class="divider"></li>
							<li><a href="#" class="validate-email"><i class="fa fa-fw fa-check"></i> [[admin:users.validate_email]]</a></li>
							<li><a href="#" class="send-validation-email"><i class="fa fa-fw fa-mail-forward"></i> [[admin:users.send_validation_email]]</a></li>
							<li><a href="#" class="password-reset-email"><i class="fa fa-fw fa-key"></i> [[admin:users.send_password_reset_email]]</a></li>
							<li class="divider"></li>
							<li><a href="#" class="ban-user"><i class="fa fa-fw fa-gavel"></i> [[admin:users.ban_user]]</a></li>
							<li><a href="#" class="unban-user"><i class="fa fa-fw fa-comment-o"></i> [[admin:users.unban_user]]</a></li>
							<li><a href="#" class="reset-lockout"><i class="fa fa-fw fa-unlock"></i> [[admin:users.reset_lockout]]</a></li>
							<li><a href="#" class="reset-flags"><i class="fa fa-fw fa-flag"></i> [[admin:users.reset_flags]]</a></li>
							<li class="divider"></li>
							<li><a href="#" class="delete-user"><i class="fa fa-fw fa-trash-o"></i> [[admin:users.delete_user]]</a></li>
						</ul>
					</div>
				</ul>

				<br />

				<div class="search {search_display} well">
					<label>[[admin:users.by_user_name]]</label>
					<input class="form-control" id="search-user-name" data-search-type="username" type="text" placeholder="[[admin:users.by_user_name_description]]"/><br />

					<label>[[admin:users.by_email]]</label>
					<input class="form-control" id="search-user-email" data-search-type="email" type="text" placeholder="[[admin:users.by_email_description]]"/><br />

					<label>[[admin:users.by_ip_address]]</label>
					<input class="form-control" id="search-user-ip" data-search-type="ip" type="text" placeholder="[[admin:users.by_ip_address_description]]"/><br />

					<i class="fa fa-spinner fa-spin hidden"></i>
					<span id="user-notfound-notify" class="label label-danger hide">[[admin:users.user_not_found]]</span><br/>
				</div>

				<ul id="users-container">
					<!-- BEGIN users -->
					<div class="users-box" data-uid="{users.uid}" data-username="{users.username}">
						<div class="user-image">
							<img src="{users.picture}" class="img-thumbnail user-selectable"/>
							<div class="labels">
								<!-- IF config.requireEmailConfirmation -->
								<!-- IF !users.email:confirmed -->
								<span class="notvalidated label label-danger">[[admin:users.not_validated]]</span>
								<!-- ENDIF !users.email:confirmed -->
								<!-- ENDIF config.requireEmailConfirmation -->
								<span class="administrator label label-primary <!-- IF !users.administrator -->[[admin:users.hide]]<!-- ENDIF !users.administrator -->">[[admin:users.admin]]</span>
								<span class="ban label label-danger <!-- IF !users.banned -->[[admin:users.hide]]<!-- ENDIF !users.banned -->">[[admin:users.banned]]</span>
							</div>
						</div>

						<a href="{config.relative_path}/user/{users.userslug}" target="_blank">{users.username} ({users.uid})</a><br/>
						<!-- IF users.email -->
						<small><span title="{users.email}">{users.email}</span></small>
						<!-- ENDIF users.email -->
						<!-- IF users.flags -->
						<div><small><span><i class="fa fa-flag"></i> {users.flags}</span></small></div>
						<!-- ENDIF users.flags -->
					</div>
					<!-- END users -->
				</ul>

				<div class="modal fade" id="create-modal">
					<div class="modal-dialog">
						<div class="modal-content">
							<div class="modal-header">
								<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
								<h4 class="modal-title">[[admin:users.create_user]]</h4>
							</div>
							<div class="modal-body">
								<div class="alert alert-danger hide" id="create-modal-error"></div>
								<form>
									<div class="form-group">
										<label for="group-name">[[admin:users.user_name]]</label>
										<input type="text" class="form-control" id="create-user-name" placeholder="User Name" />
									</div>
									<div class="form-group">
										<label for="group-name">[[admin:users.email]]</label>
										<input type="text" class="form-control" id="create-user-email" placeholder="Email of this user" />
									</div>

									<div class="form-group">
										<label for="group-name">[[admin:users.password]]</label>
										<input type="password" class="form-control" id="create-user-password" placeholder="[[admin:users.password]]" />
									</div>

									<div class="form-group">
										<label for="group-name">[[admin:users.password_confirm]]</label>
										<input type="password" class="form-control" id="create-user-password-again" placeholder="[[admin:users.password]]" />
									</div>

								</form>
							</div>
							<div class="modal-footer">
								<button type="button" class="btn btn-default" data-dismiss="modal">[[admin:users.close]]</button>
								<button type="button" class="btn btn-primary" id="create-modal-go">[[admin:users.create]]</button>
							</div>
						</div>
					</div>
				</div>



				<div class="text-center {loadmore_display}">
					<button id="load-more-users-btn" class="btn btn-primary">[[admin:users.load_more]]</button>
				</div>
				<input type="hidden" template-variable="yourid" value="{yourid}" />

			</div>
		</div>
	</div>

	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:users.users_control_panel]]</div>
			<div class="panel-body">
				<button id="createUser" class="btn btn-primary">[[admin:users.new_user]]</button>
				<a target="_blank" href="{config.relative_path}/api/admin/users/csv" class="btn btn-primary">[[admin:users.download_csv]]</a>
			</div>
		</div>
	</div>
</div>
