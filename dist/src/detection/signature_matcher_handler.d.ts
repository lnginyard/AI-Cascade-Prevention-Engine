import { EventBridgeEvent } from 'aws-lambda';
import { AnomalySignal } from './signature_detector';
type AnomalyEventDetail = {
    anomalies: AnomalySignal[];
};
export declare function handler(event: EventBridgeEvent<'AnomalyDetected', AnomalyEventDetail>): Promise<void>;
export {};
