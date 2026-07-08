"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryJobHandler = void 0;
const job_1 = require("../providers/job");
const queue_1 = require("../providers/queue");
function isRetriableState(state) {
    return state === 'failed' || state === 'completed';
}
async function retryJob(_req, job) {
    const jobState = await job.getState();
    if (!isRetriableState(jobState)) {
        return {
            status: 400,
            body: { error: `Job is in "${jobState}" state and cannot be retried` },
        };
    }
    await job.retry(jobState);
    return {
        status: 204,
        body: {},
    };
}
exports.retryJobHandler = (0, queue_1.queueProvider)((0, job_1.jobProvider)(retryJob));
//# sourceMappingURL=retryJob.js.map