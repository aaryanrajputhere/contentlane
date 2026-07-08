"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFlowTree = getFlowTree;
exports.findFlowRoot = findFlowRoot;
const bullmq_1 = require("bullmq");
// WeakMap keyed by Redis client so each distinct connection gets its own
// FlowProducer, and the entry is automatically freed when the client is GC'd.
const flowProducerCache = new WeakMap();
function findBullMQAdapter(queues) {
    for (const adapter of queues.values()) {
        if (adapter.type === 'bullmq') {
            return adapter;
        }
    }
    return null;
}
async function getFlowProducer(queues) {
    const adapter = findBullMQAdapter(queues);
    if (!adapter)
        return null;
    const client = await adapter.getClient();
    const cached = flowProducerCache.get(client);
    if (cached)
        return cached;
    const producer = new bullmq_1.FlowProducer({ connection: client });
    flowProducerCache.set(client, producer);
    return producer;
}
/**
 * Builds a lookup from raw BullMQ queue name to adapter.
 * Rebuilt on each call to stay consistent with dynamic queue changes.
 */
function buildQueueNameLookup(queues) {
    const lookup = new Map();
    for (const adapter of queues.values()) {
        if (adapter.type === 'bullmq') {
            const bmq = adapter;
            lookup.set(bmq.getName(), bmq);
        }
    }
    return lookup;
}
async function getFlowTree(queues, queueName, jobId) {
    const producer = await getFlowProducer(queues);
    if (!producer)
        return null;
    return await producer.getFlow({ queueName, id: jobId }).catch(() => null);
}
function simplifyQueueName(queueName, lookup) {
    const simpleQueueName = Array.from(lookup.keys()).find((key) => queueName === key || queueName.endsWith(':' + key));
    return simpleQueueName || queueName;
}
/**
 * Traverses the parent chain of a job across queues to find the flow root.
 * Returns the raw BullMQ queue name and job ID of the root, or null if
 * no flow root can be determined.
 */
async function findFlowRoot(queues, job) {
    var _a;
    const lookup = buildQueueNameLookup(queues);
    let currJob = job;
    while (currJob) {
        const currQueueName = simplifyQueueName(currJob.queueName, lookup);
        const parent = (_a = currJob.opts) === null || _a === void 0 ? void 0 : _a.parent;
        if (!(parent === null || parent === void 0 ? void 0 : parent.id) || !(parent === null || parent === void 0 ? void 0 : parent.queue)) {
            if (!currJob.id) {
                return null;
            }
            return { queueName: currQueueName, jobId: currJob.id };
        }
        const parentQueueName = parent.queue;
        const simpleParentQueueName = simplifyQueueName(parentQueueName, lookup);
        const parentAdapter = simpleParentQueueName ? lookup.get(simpleParentQueueName) : null;
        if (!parentAdapter) {
            return null;
        }
        const parentJob = await parentAdapter.getJob(parent.id);
        if (!parentJob) {
            return null;
        }
        currJob = parentJob;
    }
    return null;
}
//# sourceMappingURL=flow.js.map