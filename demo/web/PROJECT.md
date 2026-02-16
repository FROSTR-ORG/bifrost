# FROSTR Igloo PWA Revival Project

We are going to make the FROSTR Igloo PWA great again.

**Features**

* Reference web application for the Bifrost node.
* Runs a fully-validating Bifrost node in the browser.
* Demonstrates onboarding, configuration, and management.
* Showcases the FROSTR protocol through react framework.
* Run multiple instances and watch them interact.

## Overview

The FROSTR Igloo PWA is a demonstration of the FROSTR Bifrost node running within a web application. It uses the React and PWA frameworks to provide the user with a moden-day experience.

The PWA provides the Bifrost node with a web interface. This interface is used to configure the Bifrost node, go through the onboarding process, view logs and details, and manage the node.

The node can run as a robo-signer, or prompt the user for confirmation. The prompt will use the "content" and "type" field in order to render the request for the user.

The dashboard will show the connection status of the node:
  - Socket/subscription health (per relay).
  - Event count (send / recv)

It will also show the health of its peers, including:
  * Diagnostic information:
    - Request counts (pass / fail / accept / reject )
    - Ping counts (pass / fail / accept / reject)
    - Last message received (stamp).
  * Pool information.
  * Policy configuration (send / recv).
  * Manual button to ping.

The dashboard will also show a console, with tag filters:
  * Tagged by type: sign, ecdh, ping, echo, node
  * Tagged by origin: send / recv / local