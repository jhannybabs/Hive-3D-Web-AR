// lib/constants/response.constant.ts
export interface ResponseDTO {
  status: number;
  response: object;
  message: string;
}

// export const FUSE_URL = "http://localhost:2702/fuse/"; // only for laptop testing
export const FUSE_URL = "https://8k973b0d-2702.asse.devtunnels.ms/fuse/"; // only for phone testing
export const API_TIMEOUT_MS = 10000;
export const THROTTLE_MS = 500;
