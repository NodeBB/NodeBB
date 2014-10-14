<div class="events">
	<div class="col-sm-9">
		<div class="panel panel-default">
			<div class="panel-heading"><i class="fa fa-calendar-o"></i> Events</div>
			<div class="panel-body" data-next="{next}">
				<pre>{eventdata}</pre>
			</div>
		</div>
	</div>
</div>


<script>
require(['forum/infinitescroll'], function(infinitescroll) {

	infinitescroll.init(function(direction) {
		if (direction < 0 || !$('.events').length) {
			return;
		}

		infinitescroll.loadMore('admin.getMoreEvents', $('[data-next]').attr('data-next'), function(events, done) {
			if (events.data && events.data.length) {
				$('.panel-body pre').append(events.data);
				$('[data-next]').attr('data-next', events.next);
			}
			done();
		});
	});
});

</script>