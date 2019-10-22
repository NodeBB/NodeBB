<div class="row events">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> [[admin/advanced/events:events]]</div>
			<div class="panel-body">
				<!-- IF !events.length -->
				<div class="alert alert-info">[[admin/advanced/events:no-events]]</div>
				<!-- ENDIF !events.length -->
				<div class="events-list">
				<!-- BEGIN events -->
				<div data-eid="{events.eid}">
					<span class="label label-default">#{events.eid}</span>
					<span class="label label-info">{events.type}</span>
					<span class="label label-default">uid {events.uid}</span>
					<!-- IF events.ip --><span class="label label-default">{events.ip}</span><!-- END -->
					<a href="{config.relative_path}/user/{events.user.userslug}" target="_blank">
						<!-- IF events.user.picture -->
						<img class="avatar avatar-xs" src="{events.user.picture}" />
						<!-- ELSE -->
						<div class="avatar avatar-xs" style="background-color: {events.user.icon:bgColor};">{events.user.icon:text}</div>
						<!-- ENDIF events.user.picture -->
					</a>
					<a href="{config.relative_path}/user/{events.user.userslug}" target="_blank">{events.user.username}</a>
					<span class="pull-right">{events.timestampISO}</span>
					<pre class="well">{events.jsonString}</pre>
				</div>
				<!-- END events -->
				<!-- IMPORT partials/paginator.tpl -->
				</div>
			</div>
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin/advanced/events:filters]]</div>
			<div class="panel-body">
				<form role="form" id="filters">
					<div class="form-group">
						<label for="type">[[admin/advanced/events:filter-type]]</label>
						<select class="form-control" id="type" name="type" class="form-control">
							<!-- BEGIN types -->
							<option value="{types.value}" <!-- IF types.selected -->selected<!-- ENDIF types.selected -->>{types.name}</option>
							<!-- END types -->
						</select>
					</div>
					<div class="form-group">
						<label for="start">[[admin/advanced/events:filter-start]]</label>
						<input type="date" id="start" name="start" value="{query.start}" class="form-control" />
					</div>
					<div class="form-group">
						<label for="end">[[admin/advanced/events:filter-end]]</label>
						<input type="date" id="end" name="end" value="{query.end}" class="form-control" />
					</div>
					<div class="form-group">
						<label for="perPage">[[admin/advanced/events:filter-perPage]]</label>
						<input type="text" id="perPage" name="perPage" value="{query.perPage}" class="form-control" />
					</div>
					<button type="submit" class="btn btn-primary btn-block" id="apply">[[admin/advanced/events:filters-apply]]</button>
				</form>
			</div>
		</div>
	</div>
</div>
