<div class="row">
    <div class="col-md-9">
        <div class="clearfix">
            <div class="icon">
                <i data-name="icon" value="{icon}" class="fa {icon}"></i>
            </div>
            <div class="information">
                <h5 class="header">{name}</h5>

                <p class="description">{description}</p>
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="clearfix pull-right">
            <ul class="fa-ul stats">
                <li class="fa-li"><i class="fa fa-book"></i> {topic_count}</li>
                <li class="fa-li"><i class="fa fa-pencil"></i> {post_count}</li>
            </ul>
            <div class="btn-group">
                <button data-action="toggle" data-disabled="{disabled}" class="btn btn-xs"></button>
                <a href="./categories/{cid}" class="btn btn-default btn-xs">Edit</a>
            </div>
        </div>
    </div>
</div>