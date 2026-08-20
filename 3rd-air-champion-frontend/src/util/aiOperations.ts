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
 * Ask the TiMag assistant.
 *
 * Server-sent events, not a plain POST, and not axios — the browser's fetch is
 * the only one of the two that can read a response as it arrives.
 *
 * The reason is CloudFront: it allows an origin 30 seconds to begin responding
 * and then returns its own 504, which is exactly what a model running several
 * tool calls over a month of calendar ran into. The server now answers at once
 * and keeps the connection fed while it works, so there is no idle period to
 * time out. `onProgress` reports which books it is reading as it goes.
 *
 * The whole conversation travels with every request — the API is stateless and
 * the server keeps no session.
 */
export const askTiMag = async (
  messages: ChatTurn[],
  token: string,
  onProgress?: (tools: string[]) => void,
): Promise<ChatReply> => {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_ENDPOINT}/ai/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify({ messages }),
    });
  } catch {
    throw "Could not reach the assistant.";
  }

  if (!res.ok || !res.body) {
    // Errors raised before the stream opens are ordinary JSON — a missing API
    // key, an empty message, an expired token.
    let message = `The assistant is unavailable (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON — the status is all we have to go on */
    }
    throw message;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ChatReply | null = null;
  let failure: string | null = null;

  // SSE frames are separated by a blank line. A chunk can split one anywhere,
  // so frames are only parsed once their terminator has actually arrived.
  const consume = (frame: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith(":")) continue; // heartbeat
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (data.length === 0) return;
    let payload: any;
    try {
      payload = JSON.parse(data.join("\n"));
    } catch {
      return;
    }
    if (event === "reply") result = payload;
    else if (event === "failed") failure = payload?.error ?? "Something went wrong.";
    else if (event === "progress") onProgress?.(payload?.tools ?? []);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let split: number;
    while ((split = buffer.indexOf("\n\n")) !== -1) {
      consume(buffer.slice(0, split));
      buffer = buffer.slice(split + 2);
    }
  }
  if (buffer.trim()) consume(buffer);

  if (failure) throw failure;
  if (!result) throw "The assistant stopped before answering.";
  return result;
};
