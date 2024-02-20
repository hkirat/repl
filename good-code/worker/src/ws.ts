import { Server, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import path from "path";
import { fetchDir, fetchFileContent, saveFile } from "./fs";
import { TerminalManager } from "./pty";

const terminalManager = new TerminalManager();

export function initWs(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      // Should restrict this more!
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    const replId = socket.handshake.query["replId"] as string;

    if (!replId) {
      socket.disconnect();
      terminalManager.clear(socket.id);
      return;
    }

    socket.on("runnerLoaded", async () => {
      socket.emit("loaded", {
        rootContent: await fetchDir("/workspace", ""),
      });
    });

    initHandlers(socket, replId);
  });
}

function initHandlers(socket: Socket, replId: string) {
  socket.on("disconnect", () => {
    console.log("runner disconnected");
  });

  socket.on("fetchDir", async (dir: string, callback) => {
    const dirPath = `/workspace/${dir}`;
    const contents = await fetchDir(dirPath, dir);
    callback(contents);
  });

  socket.on("fetchContent", async (filePath: string, callback) => {
    const fullPath = `/workspace/${filePath}`;
    const data = await fetchFileContent(fullPath);
    callback(data);
  });

  socket.on("updateContent", async (fullPath: string, content: string) => {
    await saveFile(fullPath, content);
  });

  socket.on("requestTerminal", async () => {
    terminalManager.createPty(socket.id, replId, (data, id) => {
      socket.emit("terminal", {
        data: Buffer.from(data, "utf-8"),
      });
    });
  });

  socket.on("terminalData", async (data: string) => {
    terminalManager.write(socket.id, data);
  });
}
