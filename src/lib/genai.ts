import { GoogleGenerativeAI } from "@google/generative-ai";

let currentKeyIndex = 0;
const getApiKeys = (): string[] => {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY?.trim();
  if (envKey) {
    return envKey.split(',').map(key => key.trim()).filter(key => key !== '');
  }

  try {
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey && storedKey.trim() !== '') return [storedKey.trim()];
  } catch (e) {
    console.error("Error reading API key from localStorage", e);
  }

  throw new Error("No Gemini API key found. Please configure VITE_GEMINI_API_KEY in .env file.");
};

const getGenerativeModel = (forceNextKey = false) => {
  const keys = getApiKeys();
  if (forceNextKey) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;
    console.log(`[Gemini API] Switching to key index ${currentKeyIndex}`);
  }
  const key = keys[currentKeyIndex];
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
};

// Optimization Configurations
const MIN_DELAY_MS = 500;
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;

let lastRequestTime = 0;
const inFlightRequests = new Map<string, Promise<string>>();
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const executeWithRetry = async (
  cacheKey: string,
  requestFn: (model: any) => Promise<string>
): Promise<string> => {
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const promise = (async () => {
    let retries = 0;
    while (retries <= MAX_RETRIES) {
      try {
        const now = Date.now();
        const timeSince = now - lastRequestTime;
        if (timeSince < MIN_DELAY_MS) await delay(MIN_DELAY_MS - timeSince);
        lastRequestTime = Date.now();

        const model = getGenerativeModel();
        return await requestFn(model);
      } catch (error: any) {
        const isQuota = error?.message?.includes("429") || error?.status === 429;
        if (isQuota) {
          console.warn("[Gemini API] Quota exceeded, attempting key rotation...");
          getGenerativeModel(true); // Rotate key
        }
        
        if (retries >= MAX_RETRIES) {
          return isQuota
            ? "Sorry, the AI quota is exceeded. Please try again after a minute."
            : "I encountered an error. Please try again.";
        }
        retries++;
        const backoff = BASE_BACKOFF_MS * Math.pow(2, retries - 1) + Math.random() * 500;
        console.warn(`[Gemini API] Retry ${retries}/${MAX_RETRIES} in ${Math.round(backoff)}ms`);
        await delay(backoff);
      }
    }
    return "An unexpected error occurred.";
  })();

  inFlightRequests.set(cacheKey, promise);
  promise.finally(() => inFlightRequests.delete(cacheKey));
  return promise;
};

export const generateContent = async (prompt: string): Promise<string> => {
  return executeWithRetry(`content:${prompt}`, async (model) => {
    const result = await model.generateContent(prompt);
    return (await result.response).text();
  });
};

export const generateChatResponse = async (
  messages: { role: string; parts: string }[]
): Promise<string> => {
  const cacheKey = `chat:${JSON.stringify(messages)}`;
  return executeWithRetry(cacheKey, async (model) => {
    const history = messages.slice(0, -1).map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.parts }],
    }));
    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);
    return (await result.response).text();
  });
};