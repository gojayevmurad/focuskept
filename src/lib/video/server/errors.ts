import "server-only";

export class VideoError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
