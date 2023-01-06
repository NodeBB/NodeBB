# ![NodeBB](public/images/sm-card.png)

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

[**NodeBB Forum Software**](https://nodebb.org) is powered by Node.js and supports either Redis, MongoDB, or a PostgreSQL database. It utilizes web sockets for instant interactions and real-time notifications. NodeBB takes the best of the modern web: real-time streaming discussions, mobile responsiveness, and rich RESTful read/write APIs, while staying true to the original bulletin board/forum format &rarr; categorical hierarchies, local user accounts, and asynchronous messaging.

NodeBB by itself contains a "common core" of basic functionality, while additional functionality and integrations are enabled through the use of third-party plugins.

This repository is a forked version of the base [NodeBB repository](https://github.com/NodeBB/NodeBB) with modifications to support curriculum use.

### [Demo](https://try.nodebb.org) | [Documentation](https://docs.nodebb.org)

## Theming

NodeBB's theming engine is highly flexible and does not restrict your design choices. This version of the repository has our minimalist "Persona" theme installed to get you started.

NodeBB's base theme utilizes [Bootstrap 3](http://getbootstrap.com/) but themes can choose to use a different framework altogether.

[![](http://i.imgur.com/HwNEXGu.png)](http://i.imgur.com/HwNEXGu.png)
[![](http://i.imgur.com/II1byYs.png)](http://i.imgur.com/II1byYs.png)

## Installation

[Please refer to platform-specific installation documentation](https://docs.nodebb.org/installing/os)

For feature development, we highly recommend you use the suggested [grunt-cli](https://docs.nodebb.org/configuring/running/#grunt-development) to enable file-watching and live refresh.

When running in a development environment, you can find the API specs for NodeBB at [http://localhost:4567/debug/spec/read](http://localhost:4567/debug/spec/read) and [http://localhost:4567/debug/spec/write](http://localhost:4567/debug/spec/write).

## License

NodeBB is licensed under the **GNU General Public License v3 (GPL-3)** (http://www.gnu.org/copyleft/gpl.html).

## Helpful Links

* [Demo](https://try.nodebb.org)
* [Documentation & Installation Instructions](http://docs.nodebb.org)
* **Frontend Development:**
    * [Benchpress Documentation](https://github.com/benchpressjs/benchpressjs)
    * [Bootstrap 3 Documentation ](http://getbootstrap.com/)
* **Server Development:**
    * [Node.js Documentation](https://nodejs.org/en/docs/)
* **Linting & Testing:** 
    * [Mocha Documentation](https://mochajs.org/)
    * [ESLint Documentation](https://eslint.org/docs/latest/)