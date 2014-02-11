<div class="account">
	<div class="row">
		<div class="col-xs-12">
			<h4>[[global:privacy]]</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input id="showemailCheckBox" type="checkbox" <!-- IF settings.showemail -->checked<!-- ENDIF settings.showemail --> > <strong>[[user:show_email]]</strong>
					</label>
				</div>
			</div>
			<h4>Pagination</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input id="usePaginationCheckBox" type="checkbox" <!-- IF settings.usePagination -->checked<!-- ENDIF settings.usePagination -->> <strong>[[user:paginate_description]]</strong>
					</label>
				</div>

				<strong>[[user:topics_per_page]]</strong><br /> <input id="topicsPerPage" type="text" class="form-control" value="{settings.topicsPerPage}"><br />
				<strong>[[user:posts_per_page]]</strong><br /> <input id="postsPerPage" type="text" class="form-control" value="{settings.postsPerPage}"><br />
			</div>
		</div>
	</div>

	<div class="form-actions">
		<a id="submitBtn" href="#" class="btn btn-primary">[[global:save_changes]]</a>
	</div>
</div>