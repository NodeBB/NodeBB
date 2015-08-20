<!-- IMPORT admin/settings/header.tpl -->

<div class="row">
	<div class="col-xs-2 settings-header">Pagination Settings</div>
	<div class="col-xs-10">
		<form>
			<div class="checkbox">
				<label>
					<input type="checkbox" data-field="usePagination"> <strong>Paginate topics and posts instead of using infinite scroll.</strong>
				</label>
			</div>
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Topic Pagination</div>
	<div class="col-xs-10">
		<form>
			<strong>Posts per Page</strong><br /> <input type="text" class="form-control" value="20" data-field="postsPerPage">
		</form>
	</div>
</div>

<div class="row">
	<div class="col-xs-2 settings-header">Category Pagination</div>
	<div class="col-xs-10">
		<form>
			<strong>Topics per Page</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerPage"><br />
			<strong>Initial Number of Topics to Load on Unread, Recent, and Popular</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerList">
		</form>
	</div>
</div>

<!-- IMPORT admin/settings/footer.tpl -->