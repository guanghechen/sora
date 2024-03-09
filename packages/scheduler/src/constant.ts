const bit = 1

export enum PipelineStatusEnum {
  IDLE = bit << 0, // The pipeline is idel, you can `pull/push` elements into it.
  DRIED = bit << 1, // The pipeline is dried.
  CLOSED = bit << 2, // The pipeline is closed, you are not allowed to `push` elements into it.
}
