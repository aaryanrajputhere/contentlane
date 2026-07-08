import { BullBoardRequest, ControllerHandlerReturnType } from '../../typings/app';
export declare function redisStatsHandler({ queues: bullBoardQueues, uiConfig, }: BullBoardRequest): Promise<ControllerHandlerReturnType>;
