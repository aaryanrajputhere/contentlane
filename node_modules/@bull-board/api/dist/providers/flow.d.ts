import { type Job, type JobNode } from 'bullmq';
import { BullBoardQueues } from '../../typings/app';
export declare function getFlowTree(queues: BullBoardQueues, queueName: string, jobId: string): Promise<JobNode | null>;
/**
 * Traverses the parent chain of a job across queues to find the flow root.
 * Returns the raw BullMQ queue name and job ID of the root, or null if
 * no flow root can be determined.
 */
export declare function findFlowRoot(queues: BullBoardQueues, job: Job): Promise<{
    queueName: string;
    jobId: string;
} | null>;
