/**
 * @license MIT, imicros.de (c) 2019 Andreas Leinen
 */
"use strict";

const Redis = require("ioredis");
const { AclMixin } = require("imicros-acl");

/** Actions */
// action add { stream, message } => { id }  
// action read { group, count, [streams] } => [{ id, message }]  
// action ack { group, stream, [id] } => { count }
// action len { stream } => { count }

module.exports = {
    name: "streams",
    mixins: [AclMixin],
    
    /**
     * Service settings
     */
    settings: {},

    /**
     * Service metadata
     */
    metadata: {},

    /**
     * Service dependencies
     */
    //dependencies: [],	

    /**
     * Actions
     */
    actions: {

        /**
         * add message
         * 
         * @actions
         * @param {String} stream
         * @param {String} message
         * 
         * @returns {Object} { id }
         */
        add: {
            params: {
                stream: { type: "string" },
                message: { type: "object" }
            },			
            async handler(ctx) {
                let owner = await this.getOwnerId({ ctx: ctx, abort: true });
                if (!await this.isAuthorized({ ctx: ctx, ressource: { stream: ctx.params.stream }, action: "add" })) throw new Error("not authorized");
                
                let stream = owner + "-" + ctx.params.stream;
                let message = JSON.stringify(ctx.params.message);
                let maxlen = 1000;      // currently the best option...
                
                let id = await this.client.xadd(stream,"MAXLEN","~",maxlen,"*","message", message, "time", Date.now());
                return { id: id };
            }
        },

        /**
         * read message
         * 
         * @actions
         * @param {String} group
         * @param {Number} count
         * @param {String} stream
         * 
         * @returns {Array} messages [{ stream, id, message }] 
         */
        read: {
            params: {
                group: { type: "string" },
                count: { type: "number" },
                stream: { type: "string" }
            },
            async handler(ctx) {
                let owner = await this.getOwnerId({ ctx: ctx, abort: true });
                if (!await this.isAuthorized({ ctx: ctx, ressource: { stream: ctx.params.stream, group: ctx.params.group }, action: "read" })) throw new Error("not authorized");

                let group = owner + "-" + ctx.params.group;
                let consumer = this.broker.instanceID || this.broker.nodeID ;
                let streams = [owner + "-" + ctx.params.stream];
                let keys = streams.map(() => ">");                
                
                // for each stream the group must be registered
                await Promise.all(streams.map(async (stream) => {
                    let exists = false;
                    // get registered groups for the stream
                    try {
                        let groups = await this.client.xinfo("GROUPS", stream);
                        groups.map((g) => { if (g[1] === group) exists = true; });
                        if (!exists) { 
                            await this.client.xgroup("CREATE", stream, group, "0");
                            this.logger.debug("Group created", { stream: stream, group: group });
                        }
                    } catch (err) {
                        this.logger.debug("GROUPS create error", { stream: stream, group: group, error: err });
                    }
                    return exists;
                }));

                try {
                    let result = await this.client.xreadgroup("GROUP",group, consumer, "COUNT", ctx.params.count, "STREAMS", streams, keys); 
                    if (Array.isArray(result)) {
                        let messages = [];
                        // stream
                        for (let s = 0; s<result.length; s++) {
                            let stream = result[s][0];
                            // array of messages
                            let a = result[s][1];
                            for (let m = 0; m<a.length; m++) {
                                let message = {
                                    stream: stream,
                                    id: a[m][0]
                                };
                                let fields = a[m][1];
                                for (let f = 0; f<fields.length; f+=2 ) {
                                    if ( fields[f] === "message" ) {
                                        try {
                                            let value = fields[f+1];
                                            message[fields[f]] = JSON.parse(value);

                                        } catch (e) {
                                            /* could not happen if created with this service */ 
                                            /* istanbul ignore next */ 
                                            {
                                                this.logger("Failed parsing message", { stream: stream, id: a[m][0] });
                                                message[fields[f]] = fields[f+1];
                                            }
                                        }   
                                    } else {
                                        message[fields[f]] = fields[f+1];
                                    }
                                }
                                messages.push(message);
                            }
                        } 
                        return messages;
                    } else {
                        return result;    
                    }
                } catch (err) {
                    this.logger.debug("XREADGROUP error", { streams: streams, gorup: group, error: err });
                    return [];
                }
            }
        },

        /**
         * acknowledge read message
         * 
         * @actions
         * @param {String} group
         * @param {String} stream
         * @param {Array}  messages [id]
         * 
         * @returns {Object} { count } 
         */
        ack: {
            params: {
                group: { type: "string" },
                stream: { type: "string" },
                messages: { type: "array", items: "string" }
            },
            async handler(ctx) {
                let owner = await this.getOwnerId({ ctx: ctx, abort: true });
                let group = owner + "-" + ctx.params.group;
                let stream = owner + "-" + ctx.params.stream;
                
                let count = await this.client.xack(stream, group, ctx.params.messages);
                return { count };
            }
        },

        /**
         * length of stream
         * 
         * @actions
         * @param {String} stream
         * 
         * @returns {Object} { count } 
         */
        len: {
            params: {
                stream: { type: "string" }
            },
            async handler(ctx) {
                let owner = await this.getOwnerId({ ctx: ctx, abort: true });
                if (!await this.isAuthorized({ ctx: ctx, ressource: { stream: ctx.params.stream }, action: "len" })) throw new Error("not authorized");

                let stream = owner + "-" + ctx.params.stream;
                
                let count = await this.client.xlen(stream);
                return { count };
            }
        }

    },

    /**
     * Events
     */
    events: {},

    /**
     * Methods
     */
    methods: {
        
        async checkStreamExists(stream) {
            if (this.streams.indexOf(stream) > 0) return true;
            try {
                let result = await this.client.xinfo("STREAM", stream);
                this.streams.push(stream);
                this.logger.debug("Stream exists", { stream: stream, result: result });
                return true;
            } catch (err) {
                this.logger.debug("Stream doesn't exist", { stream: stream });
                return false;
            }
        },

        connect () {
            return new Promise((resolve, reject) => {
                /* istanbul ignore else */
                let redisOptions = this.settings.redis || {};   // w/o settings the client uses defaults: 127.0.0.1:6379
                this.client = new Redis(redisOptions);

                this.client.on("connect", (() => {
                    this.connected = true;
                    this.logger.info("Connected to Redis");
                    resolve();
                }).bind(this));

                this.client.on("close", (() => {
                    this.connected = false;
                    this.logger.info("Disconnected from Redis");
                }).bind(this));

                /* istanbul ignore next */
                this.client.on("error", ((err) => {
                    this.logger.error("Redis redis error", err.message);
                    this.logger.debug(err);
                    /* istanbul ignore else */
                    if (!this.connected) reject(err);
                }).bind(this));
            });
        },        
        
        async disconnect () {
            return new Promise((resolve) => {
                /* istanbul ignore else */
                if (this.client && this.connected) {
                    this.client.on("close", () => {
                        resolve();
                    });
                    this.client.disconnect();
                } else {
                    resolve();
                }
            });
        }
        
    },

    /**
     * Service created lifecycle event handler
     */
    created() {
        this.streams = [];
    },

    /**
     * Service started lifecycle event handler
     */
    async started() {
        
        // connect to redis db
        await this.connect();
        
    },

    /**
     * Service stopped lifecycle event handler
     */
    async stopped() {
        
        // disconnect from redis db
        await this.disconnect();
        
    }
    
};