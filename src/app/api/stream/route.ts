// SSE endpoint: streams aggregated GPU / CPU / Fan metrics to the client.
import { collectGpuMetrics } from "@/lib/collectors/gpu";
import { collectCpuMetrics } from "@/lib/collectors/cpu";
import { collectFanMetrics } from "@/lib/collectors/fans";
import { POLL_INTERVAL_MS } from "@/lib/constants";

export const runtime = "nodejs"; // not Edge — needs child_process
export const dynamic = "force-dynamic";

async function collectOnce() {
  const [gpus, cpu, fans] = await Promise.all([
    collectGpuMetrics(),
    collectCpuMetrics(),
    collectFanMetrics(),
  ]);
  return { timestamp: Date.now(), gpus, cpu, fans };
}

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send one snapshot immediately so the client isn't waiting on the timer.
      try {
        const first = await collectOnce();
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(first)}\n\n`)
        );
      } catch (err) {
        console.error("[SSE] initial collection error:", err);
      }

      const timer = setInterval(async () => {
        try {
          const payload = await collectOnce();
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
          );
        } catch (err) {
          console.error("[SSE] Collection error:", err);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: true })}\n\n`
            )
          );
        }
      }, POLL_INTERVAL_MS);

      // Clean up when the client disconnects.
      request.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
