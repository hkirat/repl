import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { io as clientIo, Socket as ClientSocket } from "socket.io-client";
import { saveToS3 } from "./aws";
import path from "path";

export function initWs(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      // Should restrict this more!
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    // Auth checks should happen here
    const host = socket.handshake.headers.host;
    console.log(`host is ${host}`);
    // Split the host by '.' and take the first part as replId
    const replId = host?.split(".")[0];

    if (!replId) {
      socket.disconnect();
      return;
    }

    const workerSocket = clientIo("ws://localhost:3002", {
      query: {
        replId,
      },
    });

    workerSocket.emit("runnerLoaded");

    workerSocket.on("loaded", async (data: { rootContent: File[] }) => {
      socket.emit("loaded", data);
    });

    initHandlers(socket, replId, workerSocket);
  });
}

function initHandlers(
  socket: Socket,
  replId: string,
  workerSocket: ClientSocket
) {
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });

  socket.on("fetchDir", async (dir: string, callback) => {
    workerSocket.emit("fetchDir", dir, (data: File[]) => {
      callback(data);
    });
  });

  socket.on(
    "fetchContent",
    async ({ path: filePath }: { path: string }, callback) => {
      workerSocket.emit("fetchContent", filePath, (data: string) => {
        callback(data);
      });
    }
  );

  // TODO: contents should be diff, not full file
  // Should be validated for size
  // Should be throttled before updating S3 (or use an S3 mount)
  socket.on(
    "updateContent",
    async ({ path: filePath, content }: { path: string; content: string }) => {
      const fullPath = `/workspace/${filePath}`;
      workerSocket.emit("updateContent", fullPath, content);
      await saveToS3(`code/${replId}`, filePath, content);
    }
  );

  socket.on("requestTerminal", async () => {
    workerSocket.emit("requestTerminal");
  });

  workerSocket.on("terminal", async (data: { data: Buffer }) => {
    socket.emit("terminal", data);
  });

  socket.on(
    "terminalData",
    async ({ data }: { data: string; terminalId: number }) => {
      workerSocket.emit("terminalData", data);
    }
  );
}
