const bit = 1

export enum PipelineStatusEnum {
  /**
   * The pipeline is alive, you can `pull/push` elements into it.
   */
  ALIVE = bit << 0,
  /**
   * The pipeline is closed, you are only allowed to `pull` elements from it.
   */
  CLOSED = bit << 1,
}
