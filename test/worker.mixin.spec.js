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
        streams: {
            stream: stream,
            group: `group-${timestamp}`,
            service: "streams"
        }
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

describe("Test worker mixin", () => {

    let broker, service, worker;
    beforeAll(() => {
    });
    
    afterAll(async () => {
    });
    
    describe("Test create service", () => {

        it("it should start the broker", async () => {
            broker = new ServiceBroker({
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
            opts = {
                meta: {
                    ownerId: `g-${timestamp}`
                }
            };
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