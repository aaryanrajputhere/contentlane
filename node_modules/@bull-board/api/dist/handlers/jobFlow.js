"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobFlowHandler = void 0;
const job_1 = require("../providers/job");
const queue_1 = require("../providers/queue");
async function simplifyNode(node) {
    if (!node || !node.job.id) {
        return null;
    }
    const children = await Promise.all((node.children || []).map(simplifyNode));
    const state = await node.job.getState();
    return {
        id: node.job.id,
        name: node.job.name,
        progress: node.job.progress,
        state,
        queueName: node.job.queueName,
        children: children.filter((n) => !!n),
    };
}
function emptyNodeResponse(nodeId) {
    return {
        status: 200,
        body: {
            nodeId,
            flowRoot: null,
            isFlowNode: false,
        },
    };
}
async function getJobFlow(req, job, queue) {
    var _a;
    const jobId = job.id;
    if (queue.type !== 'bullmq') {
        return emptyNodeResponse(jobId);
    }
    const { findFlowRoot, getFlowTree } = await Promise.resolve().then(() => __importStar(require('../providers/flow'))); // required to allow separation between bull & bullMQ
    const root = await findFlowRoot(req.queues, job);
    if (!root) {
        return emptyNodeResponse(jobId);
    }
    const flowTree = await getFlowTree(req.queues, root.queueName, root.jobId);
    const rootSimplified = await simplifyNode(flowTree);
    return {
        status: 200,
        body: {
            nodeId: jobId,
            isFlowNode: ((_a = rootSimplified === null || rootSimplified === void 0 ? void 0 : rootSimplified.children.length) !== null && _a !== void 0 ? _a : 0) > 0,
            flowRoot: rootSimplified,
        },
    };
}
exports.jobFlowHandler = (0, queue_1.queueProvider)((0, job_1.jobProvider)(getJobFlow), {
    skipReadOnlyModeCheck: true,
});
//# sourceMappingURL=jobFlow.js.map