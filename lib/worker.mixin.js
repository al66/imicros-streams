/**
 * @license MIT, imicros.de (c) 2019 Andreas Leinen
 */
"use strict";

const _ = require("lodash");

/** Actions */
// runner - no actions

module.exports = {
    name: "worker",
    
    /**
     * Service settings
     */
    settings: {
        /*
        streams: {
            service: "streams",
            stream: "flow.token",
            group: "flow.next"
        }
        actions: {
            read: "streams.read",
            ack: "streams.ack"
        },
        stream: "events"
        */        
    },

    /**
     * Service metadata
     */
    metadata: {},

    /**
     * Service dependencies
     */
    //dependencies: ["streams"],	

    /**
     * Actions
     */
    actions: {},

    /**
     * Events
     */
    events: {},

    /**
     * Methods
     */
    methods: {
        
        async handle({message,stream,id}) {
            this.logger.debug("Missing message handler", { stream: stream, message: message, id: id });
            return false;
        },

        async consume () {
            let params = {
                group: this.group,
                count: 1,
                stream: this.stream
            };
            let meta = {
                acl: {
                    accessToken: this.accessToken
                }
            };
            try {
                let elements = await this.broker.call(this.service + ".read", params, { meta: meta });
                if (Array.isArray(elements)) {
                    await Promise.all(elements.map(async (element) => {
                        this.logger.debug(`Elements of stream ${element.stream} received`, {
                            stream: element.stream,
                            id: element.id
                        });
                        try {
                            let result = await this.handle({ message: element.message, stream: element.stream, id: element.id });
                            if (result) {
                                let params = {
                                    group: this.group,
                                    stream: element.stream,
                                    messages: [element.id]
                                };
                                await this.broker.call(this.service + ".ack", params, { meta: meta });
                            }
                        } catch (err) {
                            this.logger.error("Error handle message", { worker: this.broker.nodeId, stream: element.stream, id: element.id });
                        }
                    }));
                }
            } catch (err) {
                this.logger.error("Error reading stream", { action: this.service + ".read", params: params, error: err });
            }
                        
        },
        
        run () {
            let loop = () => {
                this.running = true;
                this.consume().then(() => { 
                    if (this.pause) {
                        this.running = false;
                        return;
                    }
                    if (this.running) setImmediate(loop); 
                });
            };
            loop();
        },
        
        async stop () {
            this.pause = true;
            return new Promise((resolve) => {
                let check = () => {
                    if (this.running) {
                        setTimeout(check,10); 
                        return;
                    } else {
                        return resolve();   
                    }
                };
                check();
            });
        }
        
    },

    /**
     * Service created lifecycle event handler
     */
    async created() { 
    
        this.stream = _.get(this.settings,"streams.stream",null);
        if (!this.stream) {
            this.logger.error("Missing settings for stream");
            throw new Error("Stream setting is missing. You must set the stream to work on.");
        }
        this.group = _.get(this.settings,"streams.group",null);
        if (!this.group) {
            this.logger.error("Missing setting for consumer group");
            throw new Error("Consumer group setting is missing.");
        }
        this.service = _.get(this.settings,"streams.service","streams");
        
    },
    /**
     * Service started lifecycle event handler
     */
    async started() {

        // start running
        this.run();
        
    },

    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {
        
        // stop running
        await this.stop();
        
    }
    
};