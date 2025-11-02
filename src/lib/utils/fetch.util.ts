// lib/utils/fetch.util.ts
import type { ResponseDTO } from "../constants/response.constant";
import { RESPONSE } from "./response.util";

export const BASE_URL_LOCAL = "http://192.168.254.106:2701";
export const TUNNEL_URL = "https://2srdqbr0-2701.asse.devtunnels.ms";

export const GET = async (
  url: string,
  token?: string
): Promise<ResponseDTO> => {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });
    const data = await res.json();
    return RESPONSE(res.status, data, "Success");
  } catch (error: any) {
    console.log(error);
    return RESPONSE(400, error, "Bad Request");
  }
};

export const POST = async (
  url: string,
  body: object,
  token?: string
): Promise<ResponseDTO> => {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return RESPONSE(res.status, data, "Success");
  } catch (error: any) {
    console.log(error);
    return RESPONSE(400, error, "Bad Request");
  }
};
