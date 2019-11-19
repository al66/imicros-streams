"use strict";

const { ServiceBroker } = require("moleculer");
const { Streams } = require("../index");
const { StreamsWorker } = require("../index");

const timestamp = Date.now();
const stream = `stream-${timestamp}`;

let handledMessages = [];

const Worker = {
    name: "myWorker",
    mixins: [StreamsWorker],
    dependencies: ["streams"],
    settings: {
        actions: {
            read: "streams.read",
            ack: "streams.ack"
        },
        stream: stream,
        group: `group-${timestamp}`
    },
    methods: {
        async handle({message,stream,id}) {
            this.logger.info("Method handle of Worker has been called");
            handledMessages.push({
                stream: stream,
                id: id,
                message: message
            });
            return true;
        }
    }
};

const AclMock = {
    localAction(next, action) {
        return async function(ctx) {
            ctx.meta = Object.assign(ctx.meta,{
                acl: {
                    accessToken: "this is the access token",
                    ownerId: `owner-${timestamp}`,
                    unrestricted: true
                },
                user: {
                    idToken: "this is the id token",
                    id: `1-${timestamp}` , 
                    email: `1-${timestamp}@host.com` 
                }
            });
            ctx.broker.logger.debug("ACL meta data has been set", { meta: ctx.meta, action: action });
            return next(ctx);
        };
    }    
};

describe("Test worker mixin", () => {

    let broker, service, worker;
    beforeAll(() => {
    });
    
    afterAll(async () => {
    });
    
    describe("Test create service", () => {

        it("it should start the broker", async () => {
            broker = new ServiceBroker({
                middlewares:  [AclMock],
                logger: console,
                logLevel: "info" //"debug"
            });
            service = await broker.createService(Streams, Object.assign({ 
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
            worker = await broker.createService(Worker);
            await broker.start();
            expect(service).toBeDefined();
            expect(worker).toBeDefined();
        });

    });

    describe("Test add, read and ack", () => {

        let opts;
        
        beforeEach(() => {
            opts = {};
        });
        
        it("it should add and process a message", () => {
            let params = {
                stream: stream,
                message: { 
                    prop1: "Property 1",
                    prop2: 1
                }
            };
            return broker.call("streams.add", params, opts).then(async (res) => {
                function check (res) {
                    return new Promise((resolve) => {
                        let delayed = () => {
                            expect(res).toBeDefined();
                            expect(res.id).toBeDefined();
                            expect(handledMessages[0]).toBeDefined();
                            expect(handledMessages[0].id).toEqual(res.id);
                            resolve();
                        };
                        setTimeout(delayed, 30);
                    });
                }
                await check(res);
            });
            
        });
        
        it("it should return stream len 1", () => {
            let params = {
                stream: stream
            };
            return broker.call("streams.len", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.count).toEqual(1);
            });
            
        });
        
    });
 
    describe("Test stop broker", () => {
        it("should stop the broker", async () => {
            expect.assertions(1);
            await broker.stop();
            expect(broker).toBeDefined();
        });
    });    
    
});