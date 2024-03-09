const bit = 1

export enum ProductConsumerStatusEnum {
  NOT_READY = bit << 0, // Consumer is not ready.
  IDLE = bit << 1, // Consumer is idle.
  BUSY = bit << 2, // Consumer is busy.
  DISPOSED = bit << 3, // Consumer is disposed.
}

export enum PipelineStatusEnum {
  IDLE = bit << 0, // The pipeline is idel, you can `pull/push` elements into it.
  DRIED = bit << 1, // The pipeline is dried.
  CLOSED = bit << 2, // The pipeline is closed, you are not allowed to `push` elements into it.
}
