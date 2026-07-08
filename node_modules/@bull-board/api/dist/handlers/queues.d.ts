import { AppJob, BullBoardRequest, ControllerHandlerReturnType, QueueJob } from '../../typings/app';
import { BaseAdapter } from '../queueAdapters/base';
export declare const formatJob: (job: QueueJob, queue: BaseAdapter) => AppJob;
export declare function queuesHandler(req: BullBoardRequest): Promise<ControllerHandlerReturnType>;
