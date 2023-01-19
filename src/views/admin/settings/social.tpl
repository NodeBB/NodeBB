<div class="social">
	<form role="form">
		<div class="row">
			<div class="col-sm-2 col-12 settings-header">[[admin/settings/social:post-sharing]]</div>
			<div class="col-sm-10 col-12">
				<div class="form-group" id="postSharingNetworks">
					<!-- BEGIN posts -->
					<div class="form-check form-switch mb-3">
						<input type="checkbox" class="form-check-input" id="{posts.id}" data-field="{posts.id}" name="{posts.id}" <!-- IF posts.activated -->checked<!-- ENDIF posts.activated --> />
						<label for="{posts.id}" class="form-check-label">
							<i class="fa {posts.class}"></i> {posts.name}
						</label>
					</div>
					<!-- END posts -->
					<p class="form-text">[[admin/settings/social:info-plugins-additional]]</p>
				</div>
			</div>
		</div>
	</form>
</div>

<!-- IMPORT admin/partials/save_button.tpl -->