# imicros-streams
Moleculer service for Redis Streams

[![Build Status](https://travis-ci.org/al66/imicros-streams.svg?branch=master)](https://travis-ci.org/al66/imicros-streams)
[![Coverage Status](https://coveralls.io/repos/github/al66/imicros-streams/badge.svg?branch=master)](https://coveralls.io/github/al66/imicros-streams?branch=master)

[Moleculer](https://github.com/moleculerjs/moleculer) service for [Redis Streams](https://redis.io/topics/streams-intro)

## Installation
```
$ npm install imicros-streams --save
```
## Dependencies
Required mixins (or a similar mixin with the same notation):
- [imicros-acl](https://github.com/al66/imicros-acl)

# Usage
```js
const { ServiceBroker } = require("moleculer");
const { AclMixin } = require("imicros-acl");
const { Streams } = require("imicros-streams");

broker = new ServiceBroker({
    logger: console
});
broker.createService(Streams, Object.assign({ 
    mixins: [AclMixin]
}));
broker.start();
```
## Actions
- add { stream, message } => { id }  
- read { group, count, [streams] } => { [{ id, message }] }  
- ack { group, [id] } => { count }
- len { stream } => { count }
