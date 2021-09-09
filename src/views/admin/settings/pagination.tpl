<!-- IMPORT admin/partials/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/pagination:pagination]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="usePagination">
					<span class="mdl-switch__label"><strong>[[admin/settings/pagination:enable]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/pagination:topics]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin/settings/pagination:posts-per-page]]</strong><br /> <input type="text" class="form-control" value="20" data-field="postsPerPage"><br/>
			<strong>[[admin/settings/pagination:max-posts-per-page]]</strong><br /> <input type="text" class="form-control" value="20" data-field="maxPostsPerPage"><br/>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin/settings/pagination:categories]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin/settings/pagination:topics-per-page]]</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerPage"><br />
			<strong>[[admin/settings/pagination:max-topics-per-page]]</strong><br /> <input type="text" class="form-control" value="20" data-field="maxTopicsPerPage"><br/>
		</form>
	</div>
</div>

<!-- IMPORT admin/partials/settings/footer.tpl -->