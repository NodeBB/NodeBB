<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:pagination.pagination_settings]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="usePagination">
					<span class="mdl-switch__label"><strong>[[admin:pagination.pagination_settings_help]]</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:pagination.topic_pagination]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin:pagination.posts_per_page]]</strong><br /> <input type="text" class="form-control" value="20" data-field="postsPerPage">
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">[[admin:pagination.category_pagination]]</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>[[admin:pagination.topics_per_page]]</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerPage"><br />
			<strong>[[admin:pagination.topics_per_page_help]]</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerList">
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->