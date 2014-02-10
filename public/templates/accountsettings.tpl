<div class="account-username-box clearfix" data-userslug="{userslug}">

</div>

<div class="account">

	<div class="row">
		<div class="col-md-6">
			<div class="panel panel-default">
				<div class="panel-body">
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

		<div class="col-md-6">
			<div class="panel panel-default">
				<div class="panel-body">
					<h4>[[global:privacy]]</h4>
					<div class="checkbox">
						<label>
							<input id="showemailCheckBox" type="checkbox" <!-- IF settings.showemail -->checked<!-- ENDIF settings.showemail --> > [[user:show_email]]
						</label>
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="form-actions">
		<a id="submitBtn" href="#" class="btn btn-primary">[[global:save_changes]]</a>
	</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />