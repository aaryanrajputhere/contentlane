import BullQueue, { Job, Queue } from 'bull';
import { JobCleanStatus, JobCounts, JobStatus, QueueAdapterOptions, QueueJobOptions, Status } from '../../typings/app';
import { BaseAdapter } from './base';
export declare class BullAdapter extends BaseAdapter {
    queue: Queue;
    constructor(queue: Queue, options?: Partial<QueueAdapterOptions>);
    getRedisInfo(): Promise<string>;
    getName(): string;
    clean(jobStatus: JobCleanStatus, graceTimeMs: number): Promise<any>;
    addJob(name: string, data: any, options: QueueJobOptions): Promise<BullQueue.Job<any>>;
    getJob(id: string): Promise<Job | undefined | null>;
    getJobs(jobStatuses: JobStatus<'bull'>[], start?: number, end?: number): Promise<Job[]>;
    getJobCounts(): Promise<JobCounts>;
    getJobLogs(id: string): Promise<string[]>;
    isPaused(): Promise<boolean>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    empty(): Promise<void>;
    obliterate(): Promise<void>;
    promoteAll(): Promise<void>;
    removeJobScheduler(_id: string): Promise<boolean>;
    getStatuses(): Status<'bull'>[];
    getJobStatuses(): JobStatus<'bull'>[];
    getGlobalConcurrency(): Promise<number | null>;
    setGlobalConcurrency(_concurrency: number): Promise<void>;
    private alignJobData;
}
