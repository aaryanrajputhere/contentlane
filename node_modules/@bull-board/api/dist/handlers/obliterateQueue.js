"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obliterateQueueHandler = void 0;
const queue_1 = require("../providers/queue");
async function obliterateQueue(_req, queue) {
    const isPaused = await queue.isPaused();
    if (!isPaused) {
        return {
            status: 400,
            body: { error: 'Queue must be paused before obliteration' },
        };
    }
    await queue.obliterate();
    return { status: 200, body: {} };
}
exports.obliterateQueueHandler = (0, queue_1.queueProvider)(obliterateQueue);
//# sourceMappingURL=obliterateQueue.js.map