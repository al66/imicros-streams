# imicros-streams
Moleculer service for Redis Streams

[![Build Status](https://travis-ci.org/al66/imicros-streams.svg?branch=master)](https://travis-ci.org/al66/imicros-streams)
[![Coverage Status](https://coveralls.io/repos/github/al66/imicros-streams/badge.svg?branch=master)](https://coveralls.io/github/al66/imicros-streams?branch=master)

[Moleculer](https://github.com/moleculerjs/moleculer) service for [Redis Streams](https://redis.io/topics/streams-intro)

## Installation
```
$ npm install imicros-streams --save
```
# Usage Service
```js
const { ServiceBroker } = require("moleculer");
const { Streams } = require("imicros-streams");

broker = new ServiceBroker({
    logger: console
});
broker.createService(Streams, Object.assign({ 
    name: "streams",
    settings: { 
        redis: {
            port: process.env.REDIS_PORT || 6379,
            host: process.env.REDIS_HOST || "127.0.0.1",
            password: process.env.REDIS_AUTH || "",
            db: process.env.REDIS_DB || 0,
        }
    }
}));
broker.start();
```
# Usage Mixin
```js
const { StreamsWorker } = require("imicros-streams");

const Worker = {
    name: "myWorker",
    mixins: [StreamsWorker],
    dependencies: ["streams"],
    settings: {
        streams: {
            stream: "my stream",
            group: "first consumer group",
            service: "streams"
        }
    },
    methods: {
        async handle({message,stream,id}) {
            // do here your stuff
            this.logger.debug("Method handle of Worker has been called", { message: message, stream: stream, id:id });
            // return true to acknowledge, false to leave message open
            return true;
        }
    }
};

```
## Actions
- add { stream, message } => { id }  
- read { group, count, stream } => { [{ stream, id, message }] }  
- ack { group, [id] } => { count }
- len { stream } => { count }
