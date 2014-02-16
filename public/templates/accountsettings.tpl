<div class="account-username-box clearfix" data-userslug="{userslug}" data-uid="{uid}">

</div>

<div class="account">
	<div class="row">
		<div class="col-xs-12">
			<h4>[[global:privacy]]</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="showemail" /> <strong>[[user:show_email]]</strong>
					</label>
				</div>
			</div>
			<h4>[[global:pagination]]</h4>
			<div class="well">
				<div class="checkbox">
					<label>
						<input type="checkbox" data-property="usePagination"> <strong>[[user:paginate_description]]</strong>
					</label>
				</div>

				<strong>[[user:topics_per_page]]</strong><br /> <input type="text" class="form-control" data-property="topicsPerPage"><br />
				<strong>[[user:posts_per_page]]</strong><br /> <input type="text" class="form-control" data-property="postsPerPage"><br />
			</div>

			<!-- BEGIN settings -->
			<h4>{settings.title}</h4>
			<div class="well">
				{settings.content}
			</div>
			<!-- END settings -->
		</div>
	</div>

	<div class="form-actions">
		<a id="submitBtn" href="#" class="btn btn-primary">[[global:save_changes]]</a>
	</div>
</div>

<input type="hidden" template-variable="yourid" value="{yourid}" />
<input type="hidden" template-variable="theirid" value="{theirid}" />