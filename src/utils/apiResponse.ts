export class ApiResponse<T = unknown> {
  public success: boolean;
  public message: string;
  public data?: T;

  constructor(message: string, data?: T) {
    this.success = true;
    this.message = message;
    if (data !== undefined) {
      this.data = data;
    }
  }
}
