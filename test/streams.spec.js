"use strict";

const { ServiceBroker } = require("moleculer");
const { Streams } = require("../index");

const timestamp = Date.now();

describe("Test streams service", () => {

    let broker, service;
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
            await broker.start();
            expect(service).toBeDefined();
        });

    });

    describe("Test add, read and ack", () => {

        let opts, messages = [];
        
        beforeEach(() => {
            opts = { 
                meta: { 
                    acl: {
                        accessToken: "this is the access token",
                        ownerId: `owner1-${timestamp}`,
                        unrestricted: true
                    }, 
                    user: { 
                        id: `1-${timestamp}` , 
                        email: `1-${timestamp}@host.com` }, 
                    access: [`1-${timestamp}`, `2-${timestamp}`] 
                } 
            };
        });
        
        it("it should return en empty array", () => {
            let params = {
                group: `group1-${timestamp}`,
                count: 1,
                stream: `stream1-${timestamp}`
            };
            return broker.call("streams.read", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual([]);
            });
            
        });
        
        it("it should add a message", () => {
            let params = {
                stream: `stream1-${timestamp}`,
                message: { 
                    prop1: "Property 1",
                    prop2: 1
                }
            };
            return broker.call("streams.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.id).toBeDefined();
            });
            
        });
        
        it("it should return stream len 1", () => {
            let params = {
                stream: `stream1-${timestamp}`
            };
            return broker.call("streams.len", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.count).toEqual(1);
            });
            
        });
        
        it("it should read the message", () => {
            let params = {
                group: `group1-${timestamp}`,
                count: 1,
                stream: `stream1-${timestamp}`
            };
            return broker.call("streams.read", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toBeDefined();
                expect(res[0].message.prop2).toEqual(1);
                expect(res[0].time).toBeDefined();
                messages.push(res[0].id);
            });
            
        });
        
        it("it should acknowledge the message", () => {
            let params = {
                group: `group1-${timestamp}`,
                stream: `stream1-${timestamp}`,
                messages: messages
            };
            return broker.call("streams.ack", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.count).toEqual(1);
                messages = [];
            });
            
        });

        it("it should return null (no message)", () => {
            let params = {
                group: `group1-${timestamp}`,
                count: 1,
                stream: `stream1-${timestamp}`
            };
            return broker.call("streams.read", params, opts).then(res => {
                expect(res).toEqual(null);
            });
            
        });
        
        it("it should add a second message", () => {
            let params = {
                stream: `stream1-${timestamp}`,
                message: { 
                    prop1: "Property 2",
                    prop2: 2
                }
            };
            return broker.call("streams.add", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.id).toBeDefined();
            });
            
        });
        
        it("it should return stream len 2", () => {
            let params = {
                stream: `stream1-${timestamp}`
            };
            return broker.call("streams.len", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.count).toEqual(2);
            });
            
        });
        
        it("it should read second message", () => {
            let params = {
                group: `group1-${timestamp}`,
                count: 1,
                stream: `stream1-${timestamp}`
            };
            return broker.call("streams.read", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res[0]).toBeDefined();
                expect(res[0].message.prop2).toEqual(2);
                messages.push(res[0].id);
            });
            
        });
        
        it("it should acknowledge second message", () => {
            let params = {
                group: `group1-${timestamp}`,
                stream: `stream1-${timestamp}`,
                messages: messages
            };
            return broker.call("streams.ack", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.count).toEqual(1);
                messages = [];
            });
            
        });

       
    /*
        it("it should set 1. key 2. owner", () => {
            opts.meta.acl.owner.id = `g2-${timestamp}`;
            let key = `res1-${timestamp}`;
            let params = {
                key: key,
                value: { 
                    owner: 2,
                    prop1: "Property 1",
                    prop2: 2
                }
            };
            return broker.call("store.set", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.key).toBeDefined();
            });
            
        });
        
        it("it should set 2. key 1. owner", () => {
            let key = `res2-${timestamp}`;
            let params = {
                key: key,
                value: { 
                    owner: 1,
                    prop1: "Property 1",
                    prop2: 3
                }
            };
            return broker.call("store.set", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res.key).toBeDefined();
            });
            
        });
        
        it("it should get 1. key 1. owner", async () => {
            let key = `res1-${timestamp}`;
            let params = {
                key: key
            };
            let value = { 
                owner: 1,
                prop1: "Property 1",
                prop2: 2
            };
            await broker.call("store.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual(expect.objectContaining(value));
            });
            
        });
        
        it("it should get 1. key 2. owner", async () => {
            opts.meta.acl.owner.id = `g2-${timestamp}`;
            let key = `res1-${timestamp}`;
            let params = {
                key: key
            };
            let value = { 
                owner: 2,
                prop1: "Property 1",
                prop2: 2
            };
            await broker.call("store.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual(expect.objectContaining(value));
            });
            
        });
        
        it("it should get 2. key 1. owner", async () => {
            let key = `res2-${timestamp}`;
            let params = {
                key: key
            };
            let value = { 
                owner: 1,
                prop1: "Property 1",
                prop2: 3
            };
            await broker.call("store.get", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toEqual(expect.objectContaining(value));
            });
            
        });
        */
    });
 
    /*
    describe("Test inventory", () => {

        let opts;
        
        beforeEach(() => {
            opts = { 
                meta: { 
                    acl: {
                        accessToken: "this is the access token",
                        owner: {
                            id: `g1-${timestamp}`
                        }
                    }, 
                    user: { 
                        id: `1-${timestamp}` , 
                        email: `1-${timestamp}@host.com` }, 
                    access: [`1-${timestamp}`, `2-${timestamp}`] 
                } 
            };
        });
        
        it("it should return inventory", () => {
            let params = {};
            return broker.call("store.inventory", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContain(`res1-${timestamp}`);
            });
            
        });
        
    });
 
    describe("Test admin", () => {

        let opts;
        
        beforeEach(() => {
            opts = { 
                meta: { 
                    acl: {
                        service: "admin"
                    }, 
                    user: { 
                        id: `1-${timestamp}` , 
                        email: `1-${timestamp}@host.com` }, 
                    access: [`1-${timestamp}`, `2-${timestamp}`] 
                } 
            };
        });
        
        it("it should return owner list", () => {
            let params = {};
            return broker.call("store.owners", params, opts).then(res => {
                expect(res).toBeDefined();
                expect(res).toContain(`g1-${timestamp}`);
            });
            
        });
        
    });
    */
 
    describe("Test stop broker", () => {
        it("should stop the broker", async () => {
            expect.assertions(1);
            await broker.stop();
            expect(broker).toBeDefined();
        });
    });    
    
});