<div class="pagination-block text-center">
    <div class="progress-bar"></div>
    <div class="wrapper dropup">
        <i class="fa fa-2x fa-angle-double-up pointer fa-fw pagetop"></i>

        <a href="#" class="dropdown-toggle" data-toggle="dropdown">
            <span class="pagination-text"></span>
        </a>

        <i class="fa fa-2x fa-angle-double-down pointer fa-fw pagebottom"></i>
        <ul class="dropdown-menu dropdown-menu-right" role="menu">
            <li>
                <div class="row">
                    <div class="col-xs-8 post-content"></div>
                    <div class="col-xs-4 text-right">
                        <div class="scroller-content">
                            <span class="pointer pagetop">[[topic:first-post]] <i class="fa fa-angle-double-up"></i></span>
                            <div class="scroller-container">
                                <div class="scroller-thumb">
                                    <span class="thumb-text"></span>
                                    <div class="scroller-thumb-icon"></div>
                                </div>
                            </div>
                            <span class="pointer pagebottom">[[topic:last-post]] <i class="fa fa-angle-double-down"></i></span>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-xs-6">
                        <button id="myNextPostBtn" class="btn btn-default form-control" disabled>[[topic:go-to-my-next-post]]</button>
                    </div>
                    <div class="col-xs-6">
                        <input type="number" class="form-control" id="indexInput" placeholder="[[global:pagination.enter_index]]">
                    </div>
                </div>
            </li>
        </ul>
    </div>
</div>
