<div class="events">
	<div class="col-lg-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i>[[admin:events.events]]</div>
			<div class="panel-body" data-next="{next}">
				<!-- IF !events.length -->
				<div class="alert alert-info">[[admin:events.there_are_no_events]]</div>
				<!-- ENDIF !events.length -->
				<div class="events-list">
				<!-- BEGIN events -->
				<div>
					<span>#{events.eid} </span><span class="label label-info">{events.type}</span>
					<a href="{config.relative_path}/user/{events.user.userslug}" target="_blank"><img class="user-img" src="{events.user.picture}"/></a> <a href="{config.relative_path}/user/{events.user.userslug}" target="_blank">{events.user.username}</a> (uid {events.user.uid}) (IP {events.ip})
					<span class="pull-right">{events.timestampISO}</span>
					<br/><br/>
					<pre>{events.jsonString}</pre>
				</div>
				<!-- END events -->
				</div>
			</div>
		</div>
	</div>
	<div class="col-lg-3 acp-sidebar">
		<div class="panel panel-default">
			<div class="panel-heading">[[admin:events.events_control_panel]]</div>
			<div class="panel-body">
				<button class="btn btn-warning" data-action="clear"><i class="fa fa-eraser"></i>[[admin:events.delete_events]]</button>
			</div>
		</div>
	</div>
</div>
