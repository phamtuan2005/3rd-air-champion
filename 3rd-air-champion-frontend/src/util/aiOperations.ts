import axios from "axios";

const BACKEND_ENDPOINT = import.meta.env.VITE_BACKEND_ENDPOINT;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatReply {
  reply: string;
  usage: { input: number; output: number };
}

/**
 * Ask the TiMag assistant. The whole conversation goes with every request —
 * the API is stateless, and the server holds no session for this.
 *
 * The key lives on the server, never here: a VITE_ variable is compiled into
 * the bundle and readable by anyone who opens devtools.
 */
export const askTiMag = async (messages: ChatTurn[], token: string): Promise<ChatReply> => {
  try {
    const res = await axios.post(
      `${BACKEND_ENDPOINT}/ai/chat`,
      { messages },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data;
  } catch (err: any) {
    throw err?.response?.data?.error ?? "Could not reach the assistant.";
  }
};
