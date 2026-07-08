"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setGlobalConcurrencyHandler = void 0;
const queue_1 = require("../providers/queue");
async function setGlobalConcurrency(req, queue) {
    const { concurrency } = req.body;
    if (typeof concurrency !== 'number' || !Number.isInteger(concurrency) || concurrency < 0) {
        return { status: 400, body: { error: 'Invalid concurrency value' } };
    }
    await queue.setGlobalConcurrency(concurrency);
    return { status: 200, body: {} };
}
exports.setGlobalConcurrencyHandler = (0, queue_1.queueProvider)(setGlobalConcurrency);
//# sourceMappingURL=setGlobalConcurrency.js.map