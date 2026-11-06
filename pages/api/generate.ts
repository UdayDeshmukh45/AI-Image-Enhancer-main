import { Ratelimit } from "@upstash/ratelimit";
import type { NextApiRequest, NextApiResponse } from "next";
import requestIp from "request-ip";
import redis from "../../utils/redis";

type Data = string;
interface ExtendedNextApiRequest extends NextApiRequest {
  body: {
    imageUrl?: string;
  };
}

// Create a new ratelimiter, that allows 3 requests per 60 seconds
const ratelimit = redis
  ? new Ratelimit({
      redis: redis,
      limiter: Ratelimit.fixedWindow(3, "60 s"),
    })
  : undefined;

export default async function handler(
  req: ExtendedNextApiRequest,
  res: NextApiResponse<Data>
) {
  if (req.method !== "POST") {
    return res.status(405).json("Method not allowed");
  }

  // Rate Limiter Code
  if (ratelimit) {
    const identifier = requestIp.getClientIp(req) || "anonymous";
    const result = await ratelimit.limit(identifier);
    res.setHeader("X-RateLimit-Limit", result.limit);
    res.setHeader("X-RateLimit-Remaining", result.remaining);

    if (!result.success) {
      return res
        .status(429)
        .json(
          "Too many uploads in 1 minute. Please try again in a few minutes."
        );
    }
  }

  const imageUrl = req.body?.imageUrl;
  if (!imageUrl) {
    return res.status(400).json("Missing imageUrl in request body");
  }

  if (!process.env.REPLICATE_API_KEY) {
    return res
      .status(500)
      .json("Server configuration error: REPLICATE_API_KEY is not set.");
  }

  try {
    // POST request to Replicate to start the image restoration generation process
    const startResponse = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Token " + process.env.REPLICATE_API_KEY,
      },
      body: JSON.stringify({
        version:
          "9283608cc6b7be6b65a8e44983db012355fde4132009bf99d976b2f0896856a3",
        input: { img: imageUrl, version: "v1.4", scale: 2 },
      }),
    });

    const jsonStartResponse = await startResponse.json();

    if (!startResponse.ok || !jsonStartResponse.urls?.get) {
      const errorMsg =
        jsonStartResponse.detail ||
        jsonStartResponse.error ||
        "Failed to initiate restoration with Replicate API";
      return res
        .status(startResponse.status >= 400 ? startResponse.status : 500)
        .json(errorMsg);
    }

    const endpointUrl = jsonStartResponse.urls.get;

    // GET request to poll the status of the image restoration process
    let restoredImage: string | null = null;
    const maxPollAttempts = 60;
    let attempts = 0;

    while (!restoredImage && attempts < maxPollAttempts) {
      attempts++;
      console.log(`polling for result (attempt ${attempts}/${maxPollAttempts})...`);
      const finalResponse = await fetch(endpointUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Token " + process.env.REPLICATE_API_KEY,
        },
      });

      if (!finalResponse.ok) {
        return res
          .status(500)
          .json("Error while checking restoration status from Replicate");
      }

      const jsonFinalResponse = await finalResponse.json();

      if (jsonFinalResponse.status === "succeeded") {
        restoredImage = jsonFinalResponse.output;
      } else if (
        jsonFinalResponse.status === "failed" ||
        jsonFinalResponse.status === "canceled"
      ) {
        const errorDetail =
          jsonFinalResponse.error || "Image restoration failed or was canceled.";
        return res.status(500).json(errorDetail);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    if (!restoredImage) {
      return res
        .status(504)
        .json("Image restoration timed out. Please try again.");
    }

    return res.status(200).json(restoredImage);
  } catch (err: any) {
    console.error("API Error in /api/generate:", err);
    return res
      .status(500)
      .json(err.message || "An unexpected server error occurred");
  }
}
