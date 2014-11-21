	<div id="category-permissions-modal" class="modal permissions-modal fade" tabindex="-1" role="dialog" aria-labelledby="Category Permissions" aria-hidden="true">
		<div class="modal-dialog">
			<div class="modal-content">
				<div class="modal-header">
					<button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
					<h3>Category Permissions</h3>
				</div>
				<div class="modal-body">
					<p>The following users have access control permissions in this Category</p>
					<ul class="members"></ul>

					<hr />
					<form role="form">
						<div class="form-group">
							<label for="permission-search">User Search</label>
							<input class="form-control" type="text" id="permission-search" />
						</div>
					</form>
					<ul class="search-results users"></ul>

					<hr />
					<form role="form">
						<div class="form-group">
							<label for="permission-group-pick">User Groups</label>
						</div>
					</form>
					<ul class="search-results groups"></ul>

				</div>
			</div>
		</div>
	</div>