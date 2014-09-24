<!-- IMPORT admin/settings/header.tpl -->

<form>
	<div class="alert alert-warning">
		<div class="checkbox">
			<label>
				<input type="checkbox" data-field="usePagination"> <strong>Paginate topics and posts instead of using infinite scroll.</strong>
			</label>
		</div>

		<strong>Topics per Page</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerPage"><br />
		<strong>Posts per Page</strong><br /> <input type="text" class="form-control" value="20" data-field="postsPerPage"><br />
		<hr/>
		<strong>Initial Number of Topics to Load (Unread, Recent, Popular etc.)</strong><br /> <input type="text" class="form-control" value="20" data-field="topicsPerList"><br />
	</div>
</form>

<!-- IMPORT admin/settings/footer.tpl -->