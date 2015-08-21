<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Pagination Settings</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<div class="checkbox">
				<label class="mdl-switch mdl-js-switch mdl-js-ripple-effect">
					<input class="mdl-switch__input" type="checkbox" data-field="usePagination">
					<span class="mdl-switch__label"><strong>Paginate topics and posts instead of using infinite scroll.</strong></span>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Topic Pagination</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>Posts per Page</strong><br /> <input type="text" class="form-control" value="20" data-field="postsPerPage">
		</form>
	</div>
</div>

<div class="row">
	<div class="col-sm-2 col-xs-12 settings-header">Category Pagination</div>
	<div class="col-sm-10 col-xs-12">
		<form>
			<strong>Topics per Page</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerPage"><br />
			<strong>Initial Number of Topics to Load on Unread, Recent, and Popular</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerList">
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->