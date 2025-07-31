# ![NodeBB](public/images/sm-card.png)

[![Workflow](https://github.com/NodeBB/NodeBB/actions/workflows/test.yaml/badge.svg)](https://github.com/NodeBB/NodeBB/actions/workflows/test.yaml)
[![Coverage Status](https://coveralls.io/repos/github/NodeBB/NodeBB/badge.svg?branch=master)](https://coveralls.io/github/NodeBB/NodeBB?branch=master)
[![Code Climate](https://codeclimate.com/github/NodeBB/NodeBB/badges/gpa.svg)](https://codeclimate.com/github/NodeBB/NodeBB)
[![](https://dcbadge.vercel.app/api/server/p6YKPXu7er?style=flat)](https://discord.gg/p6YKPXu7er)

[**NodeBB Forum Software**](https://nodebb.org) is powered by Node.js and supports either Redis, MongoDB, or a PostgreSQL database. It utilizes web sockets for instant interactions and real-time notifications. NodeBB takes the best of the modern web: real-time streaming discussions, mobile responsiveness, and rich RESTful read/write APIs, while staying true to the original bulletin board/forum format &rarr; categorical hierarchies, local user accounts, and asynchronous messaging.

NodeBB by itself contains a "common core" of basic functionality, while additional functionality and integrations are enabled through the use of third-party plugins.

### [Try it now](//try.nodebb.org) | [Documentation](//docs.nodebb.org)

## Screenshots

NodeBB's theming engine is highly flexible and does not restrict your design choices. Check out some themed installs in these screenshots below:

[![](http://i.imgur.com/VCoOFyqb.png)](http://i.imgur.com/VCoOFyq.png)
[![](http://i.imgur.com/FLOUuIqb.png)](http://i.imgur.com/FLOUuIq.png)
[![](http://i.imgur.com/Ud1LrfIb.png)](http://i.imgur.com/Ud1LrfI.png)
[![](http://i.imgur.com/h6yZ66sb.png)](http://i.imgur.com/h6yZ66s.png)
[![](http://i.imgur.com/o90kVPib.png)](http://i.imgur.com/o90kVPi.png)
[![](http://i.imgur.com/AaRRrU2b.png)](http://i.imgur.com/AaRRrU2.png)
[![](http://i.imgur.com/LmHtPhob.png)](http://i.imgur.com/LmHtPho.png)
[![](http://i.imgur.com/paiJPJkb.jpg)](http://i.imgur.com/paiJPJk.jpg)

Our minimalist "Harmony" theme gets you going right away, no coding experience required.

![Rendering of a NodeBB install on desktop and mobile devices](https://user-images.githubusercontent.com/923011/228570420-2a4db745-b20d-474a-a571-1b59259508ef.png)

## How can I follow along/contribute?

* If you are a developer, feel free to check out the source and submit pull requests. We also have a wide array of [plugins](http://community.nodebb.org/category/7/nodebb-plugins) which would be a great starting point for learning the codebase.
* If you are a designer, [NodeBB needs themes](http://community.nodebb.org/category/10/nodebb-themes)! NodeBB's theming system allows extension of the base templates as well as styling via SCSS or CSS. NodeBB's base theme utilizes [Bootstrap 5](http://getbootstrap.com/) as a frontend toolkit.
* If you know languages other than English you can help us translate NodeBB. We use [Transifex](https://explore.transifex.com/nodebb/nodebb/) for internationalization.
* Please don't forget to **like**, **follow**, and **star our repo**! Join our growing [community](http://community.nodebb.org) to keep up to date with the latest NodeBB development.

## Requirements

NodeBB requires the following software to be installed:

* A version of Node.js at least 20 or greater ([installation/upgrade instructions](https://github.com/nodesource/distributions))
* MongoDB, version 5 or greater **or** Redis, version 7.2 or greater
* If you are using [clustering](https://docs.nodebb.org/configuring/scaling/) you need Redis installed and configured.
* nginx, version 1.3.13 or greater (**only if** intending to use nginx to proxy requests to a NodeBB)

## Installation

[Please refer to platform-specific installation documentation](https://docs.nodebb.org/installing/os).
If installing via the cloud (or using Docker), [please see cloud-based installation documentation](https://docs.nodebb.org/installing/cloud/).

## Securing NodeBB

It is important to ensure that your NodeBB and database servers are secured. Bear these points in mind:

1. While some distributions set up Redis with a more restrictive configuration, Redis by default listens to all interfaces, which is especially dangerous when a server is open to the public. Some suggestions:
    * Set `bind_address` to `127.0.0.1` so as to restrict access  to the local machine only
    * Use `requirepass` to secure Redis behind a password (preferably a long one)
    * Familiarise yourself with [Redis Security](http://redis.io/topics/security)
2. Use `iptables` to secure your server from unintended open ports. In Ubuntu, `ufw` provides a friendlier interface to working with `iptables`.
    * e.g. If your NodeBB is proxied, no ports should be open except 80 (and possibly 22, for SSH access)


## Upgrading NodeBB

Detailed upgrade instructions are listed in [Upgrading NodeBB](https://docs.nodebb.org/configuring/upgrade/)

## License

NodeBB is licensed under the **GNU General Public License v3 (GPL-3)** (http://www.gnu.org/copyleft/gpl.html).

Interested in a sublicense agreement for use of NodeBB in a non-free/restrictive environment? Contact us at sales@nodebb.org.

## More Information/Links

* [Demo](https://try.nodebb.org)
* [Developer Community](http://community.nodebb.org)
* [Documentation & Installation Instructions](https://docs.nodebb.org)
* [Help translate NodeBB](https://explore.transifex.com/nodebb/nodebb/)
* [NodeBB Blog](https://nodebb.org/blog)
* [Premium Hosting for NodeBB](https://www.nodebb.org/ "NodeBB")
* Unofficial IRC community &ndash; channel `#nodebb` on Libera.chat
* [Follow us on Twitter](http://www.twitter.com/NodeBB/ "NodeBB Twitter")
* [Like us on Facebook](http://www.facebook.com/NodeBB/ "NodeBB Facebook")
