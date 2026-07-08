"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanJobHandler = void 0;
const job_1 = require("../providers/job");
const queue_1 = require("../providers/queue");
function extractRepeatJobKey(job) {
    const key = job.repeatJobKey;
    if (typeof key === 'string' && key.length > 0) {
        return key;
    }
}
async function cleanJob(_req, job, queue) {
    var _a;
    const repeatJobKey = extractRepeatJobKey(job);
    if (repeatJobKey) {
        const removed = await queue.removeJobScheduler(repeatJobKey);
        if (!removed) {
            throw new Error(`Failed to remove scheduler ${repeatJobKey} for job ${(_a = job.toJSON().id) !== null && _a !== void 0 ? _a : 'unknown id'}.`);
        }
        return {
            status: 204,
            body: {},
        };
    }
    await job.remove();
    return {
        status: 204,
        body: {},
    };
}
exports.cleanJobHandler = (0, queue_1.queueProvider)((0, job_1.jobProvider)(cleanJob));
//# sourceMappingURL=cleanJob.js.map